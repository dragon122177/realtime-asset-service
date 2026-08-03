import type { PoolClient } from 'pg';
import type { Database } from '../database/client.js';
import type { AssetStatus, AuthenticatedUser } from '../domain/types.js';
import { HttpError } from './http-error.js';

type CreateAssetInput = {
  workspaceId: string;
  projectId: string;
  name: string;
  filename: string;
  contentType: 'model/gltf+json' | 'model/gltf-binary';
  sourceHash: string;
  objectKey: string;
  byteSize: number;
  tags: string[];
  maxAttempts: number;
  actor: AuthenticatedUser;
  correlationId: string;
};

type AssetSummaryRow = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  sourceFilename: string;
  contentType: string;
  sourceBytes: string;
  status: AssetStatus;
  tags: string[];
  processingError: string | null;
  currentVersionId: string | null;
  rowVersion: number;
  qualityScore: number | null;
  qualityDecision: string | null;
  metrics: Record<string, unknown> | null;
  findings: unknown[] | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export class ControlPlaneRepository {
  constructor(private readonly database: Database) {}

  async dashboard(workspaceId: string): Promise<Record<string, unknown>> {
    const [assets, jobs, reviews, projects, activity] = await Promise.all([
      this.database.query<{ status: AssetStatus; count: string }>(
        `SELECT status, count(*)::text AS count
         FROM assets.asset_records WHERE workspace_id = $1 GROUP BY status`,
        [workspaceId],
      ),
      this.database.query<{ queued: string; running: string; failed: string }>(
        `SELECT
           count(*) FILTER (WHERE status IN ('QUEUED', 'RETRY_WAIT'))::text AS queued,
           count(*) FILTER (WHERE status = 'RUNNING')::text AS running,
           count(*) FILTER (WHERE status = 'FAILED')::text AS failed
         FROM workflow.jobs WHERE workspace_id = $1`,
        [workspaceId],
      ),
      this.database.query<{ pending: string }>(
        `SELECT count(*)::text AS pending FROM workflow.reviews
         WHERE workspace_id = $1 AND status = 'PENDING'`,
        [workspaceId],
      ),
      this.database.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM assets.projects WHERE workspace_id = $1',
        [workspaceId],
      ),
      this.database.query<{
        id: string;
        eventType: string;
        assetId: string | null;
        payload: Record<string, unknown>;
        createdAt: string;
      }>(
        `SELECT id, event_type AS "eventType", asset_id AS "assetId", payload,
                created_at AS "createdAt"
         FROM workflow.events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 8`,
        [workspaceId],
      ),
    ]);
    const byStatus = Object.fromEntries(assets.rows.map((row) => [row.status, Number(row.count)]));
    return {
      assets: {
        total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
        byStatus,
        published: byStatus.PUBLISHED ?? 0,
        needsAttention: (byStatus.FAILED ?? 0) + (byStatus.CHANGES_REQUESTED ?? 0),
      },
      jobs: {
        queued: Number(jobs.rows[0]?.queued ?? 0),
        running: Number(jobs.rows[0]?.running ?? 0),
        failed: Number(jobs.rows[0]?.failed ?? 0),
      },
      pendingReviews: Number(reviews.rows[0]?.pending ?? 0),
      projects: Number(projects.rows[0]?.count ?? 0),
      activity: activity.rows,
    };
  }

  async listProjects(workspaceId: string): Promise<unknown[]> {
    const result = await this.database.query(
      `SELECT p.id, p.project_key AS "projectKey", p.name, p.description, p.quality_policy AS "qualityPolicy",
              count(a.id)::int AS "assetCount", p.created_at AS "createdAt", p.updated_at AS "updatedAt"
       FROM assets.projects p
       LEFT JOIN assets.asset_records a ON a.project_id = p.id
       WHERE p.workspace_id = $1
       GROUP BY p.id ORDER BY p.name`,
      [workspaceId],
    );
    return result.rows;
  }

  async listAssets(
    workspaceId: string,
    filters: { status?: AssetStatus; projectId?: string; search?: string },
  ): Promise<AssetSummaryRow[]> {
    const values: unknown[] = [workspaceId];
    const predicates = ['workspace_id = $1'];
    if (filters.status) {
      values.push(filters.status);
      predicates.push(`status = $${values.length}`);
    }
    if (filters.projectId) {
      values.push(filters.projectId);
      predicates.push(`project_id = $${values.length}`);
    }
    if (filters.search) {
      values.push(`%${filters.search}%`);
      predicates.push(`(name ILIKE $${values.length} OR source_filename ILIKE $${values.length})`);
    }
    const result = await this.database.query<AssetSummaryRow>(
      `SELECT id, project_id AS "projectId", project_name AS "projectName", name,
              source_filename AS "sourceFilename", content_type AS "contentType",
              source_bytes::text AS "sourceBytes", status, tags,
              processing_error AS "processingError", current_version_id AS "currentVersionId",
              row_version AS "rowVersion", quality_score AS "qualityScore",
              quality_decision AS "qualityDecision", metrics, findings,
              created_by_name AS "createdByName", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM assets.asset_overview WHERE ${predicates.join(' AND ')}
       ORDER BY updated_at DESC LIMIT 100`,
      values,
    );
    return result.rows;
  }

  async getAsset(workspaceId: string, assetId: string): Promise<Record<string, unknown>> {
    const [asset, versions, history, events] = await Promise.all([
      this.database.query<AssetSummaryRow>(
        `SELECT id, project_id AS "projectId", project_name AS "projectName", name,
                source_filename AS "sourceFilename", content_type AS "contentType",
                source_bytes::text AS "sourceBytes", status, tags,
                processing_error AS "processingError", current_version_id AS "currentVersionId",
                row_version AS "rowVersion", quality_score AS "qualityScore",
                quality_decision AS "qualityDecision", metrics, findings,
                created_by_name AS "createdByName", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM assets.asset_overview WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, assetId],
      ),
      this.database.query(
        `SELECT id, version_number AS "versionNumber", kind, content_type AS "contentType",
                byte_size::text AS "byteSize", sha256, processor_version AS "processorVersion",
                manifest, created_at AS "createdAt"
         FROM assets.asset_versions WHERE workspace_id = $1 AND asset_id = $2
         ORDER BY created_at DESC`,
        [workspaceId, assetId],
      ),
      this.database.query(
        `SELECT from_status AS "fromStatus", to_status AS "toStatus", reason,
                changed_at AS "changedAt"
         FROM assets.status_history WHERE workspace_id = $1 AND asset_id = $2
         ORDER BY changed_at DESC LIMIT 30`,
        [workspaceId, assetId],
      ),
      this.database.query(
        `SELECT id, event_type AS "eventType", payload, created_at AS "createdAt"
         FROM workflow.events WHERE workspace_id = $1 AND asset_id = $2
         ORDER BY created_at DESC LIMIT 30`,
        [workspaceId, assetId],
      ),
    ]);
    if (!asset.rows[0]) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    return {
      ...asset.rows[0],
      versions: versions.rows,
      history: history.rows,
      events: events.rows,
    };
  }

  async createAsset(input: CreateAssetInput): Promise<{ asset: unknown; deduplicated: boolean }> {
    const result = await this.database.transaction(async (client) => {
      const project = await client.query(
        'SELECT id FROM assets.projects WHERE id = $1 AND workspace_id = $2',
        [input.projectId, input.workspaceId],
      );
      if (!project.rowCount) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO assets.asset_records (
           workspace_id, project_id, name, source_filename, content_type, source_hash,
           source_object_key, source_bytes, status, tags, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'UPLOADED',$9,$10)
         ON CONFLICT (project_id, source_hash) DO NOTHING RETURNING id`,
        [
          input.workspaceId,
          input.projectId,
          input.name,
          input.filename,
          input.contentType,
          input.sourceHash,
          input.objectKey,
          input.byteSize,
          input.tags,
          input.actor.id,
        ],
      );
      let assetId = inserted.rows[0]?.id;
      if (!assetId) {
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM assets.asset_records WHERE project_id = $1 AND source_hash = $2',
          [input.projectId, input.sourceHash],
        );
        assetId = existing.rows[0]?.id;
        if (!assetId) throw new Error('deduplication_lookup_failed');
        return { assetId, deduplicated: true };
      }

      const version = await client.query<{ id: string }>(
        `INSERT INTO assets.asset_versions (
           workspace_id, asset_id, version_number, kind, object_key, content_type, byte_size,
           sha256, manifest
         ) VALUES ($1,$2,1,'SOURCE',$3,$4,$5,$6,$7) RETURNING id`,
        [
          input.workspaceId,
          assetId,
          input.objectKey,
          input.contentType,
          input.byteSize,
          input.sourceHash,
          JSON.stringify({ originalFilename: input.filename }),
        ],
      );
      await client.query(
        `UPDATE assets.asset_records SET status = 'QUEUED', current_version_id = $2 WHERE id = $1`,
        [assetId, version.rows[0]?.id],
      );
      await this.recordStatus(client, input, assetId, null, 'UPLOADED', 'Source accepted');
      await this.recordStatus(
        client,
        input,
        assetId,
        'UPLOADED',
        'QUEUED',
        'Processing job created',
      );
      await client.query(
        `INSERT INTO workflow.jobs (
           workspace_id, asset_id, job_type, status, max_attempts, idempotency_key
         ) VALUES ($1,$2,'ANALYZE_AND_PACKAGE','QUEUED',$3,$4)`,
        [input.workspaceId, assetId, input.maxAttempts, `${assetId}:process:1`],
      );
      await this.event(client, input.workspaceId, assetId, 'ASSET_QUEUED', {
        filename: input.filename,
        bytes: input.byteSize,
      });
      await this.audit(
        client,
        input.actor,
        input.correlationId,
        'asset.uploaded',
        'asset',
        assetId,
        {
          projectId: input.projectId,
          sourceHash: input.sourceHash,
        },
      );
      return { assetId, deduplicated: false };
    });
    return {
      asset: await this.getAsset(input.workspaceId, result.assetId),
      deduplicated: result.deduplicated,
    };
  }

  async listJobs(workspaceId: string): Promise<unknown[]> {
    const result = await this.database.query(
      `SELECT j.id, j.asset_id AS "assetId", a.name AS "assetName", j.job_type AS "jobType",
              j.status, j.priority, j.attempt, j.max_attempts AS "maxAttempts",
              j.run_after AS "runAfter", j.locked_by AS "lockedBy", j.last_error AS "lastError",
              j.created_at AS "createdAt", j.updated_at AS "updatedAt", j.completed_at AS "completedAt"
       FROM workflow.jobs j JOIN assets.asset_records a ON a.id = j.asset_id
       WHERE j.workspace_id = $1 ORDER BY j.created_at DESC LIMIT 100`,
      [workspaceId],
    );
    return result.rows;
  }

  async listReviews(workspaceId: string, status = 'PENDING'): Promise<unknown[]> {
    const result = await this.database.query(
      `SELECT id, asset_id AS "assetId", version_id AS "versionId", status, summary,
              asset_name AS "assetName", source_filename AS "sourceFilename",
              project_id AS "projectId", project_name AS "projectName",
              quality_score AS "qualityScore", quality_decision AS "qualityDecision",
              metrics, findings, created_at AS "createdAt"
       FROM workflow.pending_review_overview
       WHERE workspace_id = $1 AND status = $2 ORDER BY created_at`,
      [workspaceId, status],
    );
    return result.rows;
  }

  async decideReview(input: {
    workspaceId: string;
    reviewId: string;
    decision: 'APPROVED' | 'CHANGES_REQUESTED';
    summary: string;
    actor: AuthenticatedUser;
    correlationId: string;
  }): Promise<void> {
    await this.database.transaction(async (client) => {
      const result = await client.query<{ asset_id: string; status: string }>(
        `SELECT asset_id, status FROM workflow.reviews
         WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [input.reviewId, input.workspaceId],
      );
      const review = result.rows[0];
      if (!review) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
      if (review.status !== 'PENDING') {
        throw new HttpError(409, 'REVIEW_ALREADY_DECIDED', 'Review was already decided.');
      }
      const asset = await client.query<{ status: AssetStatus }>(
        'SELECT status FROM assets.asset_records WHERE id = $1 FOR UPDATE',
        [review.asset_id],
      );
      if (asset.rows[0]?.status !== 'READY_FOR_REVIEW') {
        throw new HttpError(409, 'ASSET_NOT_REVIEWABLE', 'Asset is not ready for review.');
      }
      await client.query(
        `UPDATE workflow.reviews
         SET status = $2, summary = $3, decided_by = $4, decided_at = now() WHERE id = $1`,
        [input.reviewId, input.decision, input.summary, input.actor.id],
      );
      const targetStatus = input.decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED';
      await client.query('UPDATE assets.asset_records SET status = $2 WHERE id = $1', [
        review.asset_id,
        targetStatus,
      ]);
      await this.recordStatus(
        client,
        input,
        review.asset_id,
        'READY_FOR_REVIEW',
        targetStatus,
        input.summary || 'Quality review decision',
      );
      if (targetStatus === 'APPROVED') {
        await client.query(`UPDATE assets.asset_records SET status = 'PUBLISHED' WHERE id = $1`, [
          review.asset_id,
        ]);
        await this.recordStatus(
          client,
          input,
          review.asset_id,
          'APPROVED',
          'PUBLISHED',
          'Approved delivery version published',
        );
      }
      await this.event(client, input.workspaceId, review.asset_id, `REVIEW_${input.decision}`, {
        reviewId: input.reviewId,
        summary: input.summary,
      });
      await this.audit(
        client,
        input.actor,
        input.correlationId,
        `review.${input.decision.toLowerCase()}`,
        'review',
        input.reviewId,
        { assetId: review.asset_id },
      );
    });
  }

  async reprocessAsset(input: {
    workspaceId: string;
    assetId: string;
    maxAttempts: number;
    actor: AuthenticatedUser;
    correlationId: string;
  }): Promise<void> {
    await this.database.transaction(async (client) => {
      const result = await client.query<{ status: AssetStatus; row_version: number }>(
        `SELECT status, row_version FROM assets.asset_records
         WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [input.assetId, input.workspaceId],
      );
      const asset = result.rows[0];
      if (!asset) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
      if (!['FAILED', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED'].includes(asset.status)) {
        throw new HttpError(409, 'ASSET_NOT_REPROCESSABLE', 'Asset cannot be reprocessed now.');
      }
      await client.query(
        `UPDATE assets.asset_records SET status = 'QUEUED', processing_error = NULL WHERE id = $1`,
        [input.assetId],
      );
      const revision = asset.row_version + 1;
      await client.query(
        `INSERT INTO workflow.jobs (
           workspace_id, asset_id, job_type, status, max_attempts, idempotency_key
         ) VALUES ($1,$2,'ANALYZE_AND_PACKAGE','QUEUED',$3,$4)`,
        [
          input.workspaceId,
          input.assetId,
          input.maxAttempts,
          `${input.assetId}:process:${revision}`,
        ],
      );
      await this.recordStatus(
        client,
        input,
        input.assetId,
        asset.status,
        'QUEUED',
        'Manual reprocessing requested',
      );
      await this.event(client, input.workspaceId, input.assetId, 'ASSET_REQUEUED', {});
      await this.audit(
        client,
        input.actor,
        input.correlationId,
        'asset.reprocessed',
        'asset',
        input.assetId,
        {},
      );
    });
  }

  async retryJob(input: {
    workspaceId: string;
    jobId: string;
    actor: AuthenticatedUser;
    correlationId: string;
  }): Promise<void> {
    const job = await this.database.query<{ asset_id: string }>(
      `SELECT asset_id FROM workflow.jobs WHERE id = $1 AND workspace_id = $2 AND status = 'FAILED'`,
      [input.jobId, input.workspaceId],
    );
    const assetId = job.rows[0]?.asset_id;
    if (!assetId) throw new HttpError(409, 'JOB_NOT_RETRYABLE', 'Job is not retryable.');
    await this.reprocessAsset({ ...input, assetId, maxAttempts: 4 });
  }

  async contentLocation(
    workspaceId: string,
    assetId: string,
    kind: 'source' | 'delivery',
  ): Promise<{ objectKey: string; contentType: string; filename: string; byteSize: number }> {
    const result = await this.database.query<{
      objectKey: string;
      contentType: string;
      filename: string;
      byteSize: string;
    }>(
      `SELECT v.object_key AS "objectKey", v.content_type AS "contentType",
              a.source_filename AS filename, v.byte_size::text AS "byteSize"
       FROM assets.asset_records a
       JOIN assets.asset_versions v ON v.asset_id = a.id
       WHERE a.workspace_id = $1 AND a.id = $2 AND v.kind = $3
       ORDER BY v.version_number DESC LIMIT 1`,
      [workspaceId, assetId, kind === 'source' ? 'SOURCE' : 'DELIVERY'],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'ASSET_CONTENT_NOT_FOUND', 'Asset content not found.');
    return { ...row, byteSize: Number(row.byteSize) };
  }

  async listAudit(workspaceId: string): Promise<unknown[]> {
    const result = await this.database.query(
      `SELECT e.id::text, e.action, e.target_type AS "targetType", e.target_id AS "targetId",
              e.correlation_id AS "correlationId", e.context, e.occurred_at AS "occurredAt",
              coalesce(u.display_name, 'System worker') AS "actorName"
       FROM audit.events e LEFT JOIN identity.users u ON u.id = e.actor_id
       WHERE e.workspace_id = $1 ORDER BY e.occurred_at DESC LIMIT 150`,
      [workspaceId],
    );
    return result.rows;
  }

  private recordStatus(
    client: PoolClient,
    input: { workspaceId: string; actor?: AuthenticatedUser; correlationId: string },
    assetId: string,
    fromStatus: AssetStatus | null,
    toStatus: AssetStatus,
    reason: string,
  ): Promise<unknown> {
    return client.query(
      `INSERT INTO assets.status_history (
         workspace_id, asset_id, from_status, to_status, reason, correlation_id, changed_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.workspaceId,
        assetId,
        fromStatus,
        toStatus,
        reason,
        input.correlationId,
        input.actor?.id ?? null,
      ],
    );
  }

  private event(
    client: PoolClient,
    workspaceId: string,
    assetId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    return client.query(
      `INSERT INTO workflow.events (workspace_id, asset_id, event_type, payload)
       VALUES ($1,$2,$3,$4)`,
      [workspaceId, assetId, eventType, JSON.stringify(payload)],
    );
  }

  private audit(
    client: PoolClient,
    actor: AuthenticatedUser,
    correlationId: string,
    action: string,
    targetType: string,
    targetId: string,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    return client.query(
      `INSERT INTO audit.events (
         workspace_id, actor_id, action, target_type, target_id, correlation_id, context
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        actor.workspaceId,
        actor.id,
        action,
        targetType,
        targetId,
        correlationId,
        JSON.stringify(context),
      ],
    );
  }
}
