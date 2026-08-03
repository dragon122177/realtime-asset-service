import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { parseByteRange } from '../domain/byte-range.js';
import { analyzeGltf } from '../domain/gltf-analyzer.js';
import { safeSegment, sourceObjectKey } from '../domain/object-key.js';
import { assetStatuses } from '../domain/types.js';
import { authenticate, authorize, currentUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';
import { HttpError } from '../services/http-error.js';
import type { OperationalMetrics } from '../services/metrics.js';
import type { ObjectStore } from '../services/object-store.js';
import type { RealtimeHub } from '../services/realtime-hub.js';

const listSchema = z.object({
  status: z.enum(assetStatuses).optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});
const idSchema = z.object({ id: z.string().uuid() });
const contentSchema = z.object({ kind: z.enum(['source', 'delivery']).default('delivery') });

function contentType(filename: string, supplied: string): 'model/gltf+json' | 'model/gltf-binary' {
  const lower = filename.toLowerCase();
  if (
    lower.endsWith('.gltf') &&
    ['model/gltf+json', 'application/json', 'application/octet-stream'].includes(supplied)
  ) {
    return 'model/gltf+json';
  }
  if (
    lower.endsWith('.glb') &&
    ['model/gltf-binary', 'application/octet-stream'].includes(supplied)
  ) {
    return 'model/gltf-binary';
  }
  throw new HttpError(415, 'UNSUPPORTED_ASSET', 'Upload one .gltf or .glb file.');
}

export function registerAssetRoutes(
  app: FastifyInstance,
  dependencies: {
    config: AppConfig;
    auth: AuthService;
    repository: ControlPlaneRepository;
    store: ObjectStore;
    realtime: RealtimeHub;
    metrics: OperationalMetrics;
  },
): void {
  const { config, auth, repository, store, realtime, metrics } = dependencies;
  app.get('/api/v1/assets', { preHandler: authenticate(auth) }, async (request) => {
    const filters = listSchema.parse(request.query);
    return { assets: await repository.listAssets(currentUser(request).workspaceId, filters) };
  });

  app.get('/api/v1/assets/:id', { preHandler: authenticate(auth) }, async (request) => {
    const { id } = idSchema.parse(request.params);
    return repository.getAsset(currentUser(request).workspaceId, id);
  });

  app.post(
    '/api/v1/assets',
    {
      preHandler: [authenticate(auth), authorize('ADMIN', 'ARTIST')],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const fields: Record<string, string> = {};
      let upload: { filename: string; mimetype: string; bytes: Buffer } | undefined;
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (upload)
            throw new HttpError(400, 'ONE_FILE_REQUIRED', 'Upload exactly one asset file.');
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const chunk of part.file) {
            const buffer = Buffer.from(chunk as Uint8Array);
            total += buffer.length;
            if (total > config.maxUploadBytes) {
              throw new HttpError(413, 'UPLOAD_TOO_LARGE', 'The asset exceeds the upload limit.');
            }
            chunks.push(buffer);
          }
          upload = {
            filename: part.filename,
            mimetype: part.mimetype,
            bytes: Buffer.concat(chunks),
          };
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
      if (!upload || upload.bytes.length === 0) {
        throw new HttpError(400, 'ASSET_FILE_REQUIRED', 'A non-empty asset file is required.');
      }
      const projectId = z.string().uuid().parse(fields.projectId);
      const type = contentType(upload.filename, upload.mimetype);
      try {
        analyzeGltf(upload.bytes, upload.filename);
      } catch (error) {
        metrics.uploads.inc({
          result: 'rejected',
          format: type.endsWith('binary') ? 'glb' : 'gltf',
        });
        const reason = error instanceof Error ? error.message : 'invalid_asset';
        throw new HttpError(422, 'INVALID_GLTF', 'The source is not a valid glTF 2.0 asset.', {
          reason,
        });
      }
      const actor = currentUser(request);
      const sourceHash = createHash('sha256').update(upload.bytes).digest('hex');
      const objectKey = sourceObjectKey({
        workspaceId: actor.workspaceId,
        projectId,
        sha256: sourceHash,
        filename: upload.filename,
      });
      await store.put(objectKey, upload.bytes, type);
      const name = (fields.name?.trim() || upload.filename.replace(/\.(gltf|glb)$/i, '')).slice(
        0,
        160,
      );
      const tags = (fields.tags ?? '')
        .split(',')
        .map((tag) => safeSegment(tag))
        .filter(Boolean)
        .slice(0, 12);
      const created = await repository.createAsset({
        workspaceId: actor.workspaceId,
        projectId,
        name,
        filename: upload.filename,
        contentType: type,
        sourceHash,
        objectKey,
        byteSize: upload.bytes.length,
        tags,
        maxAttempts: config.workerMaxAttempts,
        actor,
        correlationId: request.correlationId,
      });
      metrics.uploads.inc({
        result: created.deduplicated ? 'deduplicated' : 'accepted',
        format: type.endsWith('binary') ? 'glb' : 'gltf',
      });
      if (!created.deduplicated) {
        await realtime.publish({
          workspaceId: actor.workspaceId,
          assetId: (created.asset as { id: string }).id,
          eventType: 'ASSET_QUEUED',
          occurredAt: new Date().toISOString(),
        });
      }
      return reply.status(created.deduplicated ? 200 : 201).send(created);
    },
  );

  app.get(
    '/api/v1/assets/:id/content',
    { preHandler: authenticate(auth) },
    async (request, reply) => {
      const { id } = idSchema.parse(request.params);
      const { kind } = contentSchema.parse(request.query);
      const location = await repository.contentLocation(currentUser(request).workspaceId, id, kind);
      const bytes = await store.get(location.objectKey);
      reply.header('accept-ranges', 'bytes');
      reply.header('content-type', location.contentType);
      reply.header('content-disposition', `inline; filename="${safeSegment(location.filename)}"`);
      reply.header(
        'cache-control',
        kind === 'delivery' ? 'private, max-age=60' : 'private, no-store',
      );
      try {
        const range = parseByteRange(request.headers.range, bytes.length);
        if (!range) return reply.send(bytes);
        reply.status(206);
        reply.header('content-range', `bytes ${range.start}-${range.end}/${bytes.length}`);
        reply.header('content-length', String(range.end - range.start + 1));
        return reply.send(bytes.subarray(range.start, range.end + 1));
      } catch {
        reply.status(416);
        reply.header('content-range', `bytes */${bytes.length}`);
        return reply.send();
      }
    },
  );

  app.post(
    '/api/v1/assets/:id/reprocess',
    { preHandler: [authenticate(auth), authorize('ADMIN', 'ARTIST')] },
    async (request, reply) => {
      const { id } = idSchema.parse(request.params);
      const actor = currentUser(request);
      await repository.reprocessAsset({
        workspaceId: actor.workspaceId,
        assetId: id,
        maxAttempts: config.workerMaxAttempts,
        actor,
        correlationId: request.correlationId,
      });
      await realtime.publish({
        workspaceId: actor.workspaceId,
        assetId: id,
        eventType: 'ASSET_REQUEUED',
        occurredAt: new Date().toISOString(),
      });
      return reply.status(202).send({ status: 'queued' });
    },
  );
}
