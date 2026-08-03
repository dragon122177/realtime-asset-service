import { randomUUID } from 'node:crypto';
import type { Database } from '../database/client.js';
import { processingTargetStatus } from '../domain/asset-state-machine.js';
import type { AssetAnalysis, AssetStatus, QualityReport } from '../domain/types.js';
import { retryDelaySeconds } from '../domain/job-backoff.js';

export type ClaimedJob = {
  id: string;
  workspaceId: string;
  assetId: string;
  projectId: string;
  assetName: string;
  sourceFilename: string;
  sourceHash: string;
  sourceObjectKey: string;
  contentType: 'model/gltf+json' | 'model/gltf-binary';
  attempt: number;
  maxAttempts: number;
};

export class WorkerRepository {
  constructor(private readonly database: Database) {}

  async claim(workerId: string): Promise<ClaimedJob | null> {
    return this.database.transaction(async (client) => {
      const claimed = await client.query<{
        id: string;
        workspace_id: string;
        asset_id: string;
        attempt: number;
        max_attempts: number;
      }>(
        `WITH candidate AS (
           SELECT id FROM workflow.jobs
           WHERE status IN ('QUEUED', 'RETRY_WAIT') AND run_after <= now()
           ORDER BY priority DESC, run_after, created_at
           FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE workflow.jobs job
         SET status = 'RUNNING', attempt = job.attempt + 1, locked_at = now(), locked_by = $1
         FROM candidate WHERE job.id = candidate.id
         RETURNING job.id, job.workspace_id, job.asset_id, job.attempt, job.max_attempts`,
        [workerId],
      );
      const job = claimed.rows[0];
      if (!job) return null;
      const asset = await client.query<{
        project_id: string;
        name: string;
        source_filename: string;
        source_hash: string;
        source_object_key: string;
        content_type: 'model/gltf+json' | 'model/gltf-binary';
        status: AssetStatus;
      }>(
        `SELECT project_id, name, source_filename, source_hash, source_object_key, content_type, status
         FROM assets.asset_records WHERE id = $1 FOR UPDATE`,
        [job.asset_id],
      );
      const record = asset.rows[0];
      if (!record || !['QUEUED', 'PROCESSING'].includes(record.status)) {
        await client.query(
          `UPDATE workflow.jobs SET status = 'FAILED', last_error = 'asset is not processable',
                  completed_at = now() WHERE id = $1`,
          [job.id],
        );
        return null;
      }
      if (record.status === 'QUEUED') {
        const correlationId = randomUUID();
        await client.query(`UPDATE assets.asset_records SET status = 'PROCESSING' WHERE id = $1`, [
          job.asset_id,
        ]);
        await client.query(
          `INSERT INTO assets.status_history (
             workspace_id, asset_id, from_status, to_status, reason, correlation_id
           ) VALUES ($1,$2,'QUEUED','PROCESSING','Worker claimed processing job',$3)`,
          [job.workspace_id, job.asset_id, correlationId],
        );
        await client.query(
          `INSERT INTO workflow.events (workspace_id, asset_id, event_type, payload)
           VALUES ($1,$2,'PROCESSING_STARTED',$3)`,
          [job.workspace_id, job.asset_id, JSON.stringify({ workerId, attempt: job.attempt })],
        );
      }
      return {
        id: job.id,
        workspaceId: job.workspace_id,
        assetId: job.asset_id,
        projectId: record.project_id,
        assetName: record.name,
        sourceFilename: record.source_filename,
        sourceHash: record.source_hash,
        sourceObjectKey: record.source_object_key,
        contentType: record.content_type,
        attempt: job.attempt,
        maxAttempts: job.max_attempts,
      };
    });
  }

  async complete(input: {
    job: ClaimedJob;
    deliveryObjectKey: string;
    deliveryHash: string;
    deliveryBytes: number;
    processorVersion: string;
    analysis: AssetAnalysis;
    quality: QualityReport;
  }): Promise<string> {
    return this.database.transaction(async (client) => {
      const lock = await client.query<{ status: string }>(
        'SELECT status FROM workflow.jobs WHERE id = $1 FOR UPDATE',
        [input.job.id],
      );
      if (lock.rows[0]?.status !== 'RUNNING') throw new Error('job_not_running');
      const versionNumber = await client.query<{ next: number }>(
        `SELECT coalesce(max(version_number), 0)::int + 1 AS next
         FROM assets.asset_versions WHERE asset_id = $1 AND kind = 'DELIVERY'`,
        [input.job.assetId],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO assets.asset_versions (
           workspace_id, asset_id, version_number, kind, object_key, content_type, byte_size,
           sha256, processor_version, manifest
         ) VALUES ($1,$2,$3,'DELIVERY',$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          input.job.workspaceId,
          input.job.assetId,
          versionNumber.rows[0]?.next ?? 1,
          input.deliveryObjectKey,
          input.job.contentType,
          input.deliveryBytes,
          input.deliveryHash,
          input.processorVersion,
          JSON.stringify({ analysis: input.analysis, quality: input.quality }),
        ],
      );
      const versionId = version.rows[0]?.id;
      if (!versionId) throw new Error('version_insert_failed');
      const targetStatus = processingTargetStatus(input.quality.decision);
      await client.query(
        `INSERT INTO assets.asset_metrics (
           asset_id, workspace_id, version_id, metrics, quality_score, quality_decision, findings
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (asset_id) DO UPDATE SET
           version_id = EXCLUDED.version_id,
           metrics = EXCLUDED.metrics,
           quality_score = EXCLUDED.quality_score,
           quality_decision = EXCLUDED.quality_decision,
           findings = EXCLUDED.findings,
           updated_at = now()`,
        [
          input.job.assetId,
          input.job.workspaceId,
          versionId,
          JSON.stringify(input.analysis),
          input.quality.score,
          input.quality.decision,
          JSON.stringify(input.quality.findings),
        ],
      );
      await client.query(
        `UPDATE assets.asset_records
         SET status = $2, current_version_id = $3, processing_error = NULL
         WHERE id = $1`,
        [input.job.assetId, targetStatus, versionId],
      );
      const correlationId = randomUUID();
      await client.query(
        `INSERT INTO assets.status_history (
           workspace_id, asset_id, from_status, to_status, reason, correlation_id
           ) VALUES ($1,$2,'PROCESSING',$3,$4,$5)`,
        [
          input.job.workspaceId,
          input.job.assetId,
          targetStatus,
          targetStatus === 'CHANGES_REQUESTED'
            ? 'Automated quality policy blocked the delivery candidate'
            : 'Processor created a delivery candidate',
          correlationId,
        ],
      );
      if (targetStatus === 'READY_FOR_REVIEW') {
        await client.query(
          `INSERT INTO workflow.reviews (workspace_id, asset_id, version_id, status, summary)
           VALUES ($1,$2,$3,'PENDING',$4)`,
          [
            input.job.workspaceId,
            input.job.assetId,
            versionId,
            `${input.quality.decision} · quality score ${input.quality.score}/100`,
          ],
        );
      }
      await client.query(
        `UPDATE workflow.jobs SET status = 'SUCCEEDED', completed_at = now(), locked_at = NULL,
                locked_by = NULL, last_error = NULL WHERE id = $1`,
        [input.job.id],
      );
      await client.query(
        `INSERT INTO workflow.events (workspace_id, asset_id, event_type, payload)
         VALUES ($1,$2,'PROCESSING_COMPLETED',$3)`,
        [
          input.job.workspaceId,
          input.job.assetId,
          JSON.stringify({
            versionId,
            qualityScore: input.quality.score,
            qualityDecision: input.quality.decision,
          }),
        ],
      );
      await client.query(
        `INSERT INTO audit.events (
           workspace_id, action, target_type, target_id, correlation_id, context
         ) VALUES ($1,'processor.completed','asset',$2,$3,$4)`,
        [
          input.job.workspaceId,
          input.job.assetId,
          correlationId,
          JSON.stringify({
            jobId: input.job.id,
            versionId,
            processorVersion: input.processorVersion,
          }),
        ],
      );
      return versionId;
    });
  }

  async fail(
    job: ClaimedJob,
    error: string,
  ): Promise<{ terminal: boolean; retryInSeconds?: number }> {
    return this.database.transaction(async (client) => {
      const lock = await client.query<{ status: string }>(
        'SELECT status FROM workflow.jobs WHERE id = $1 FOR UPDATE',
        [job.id],
      );
      if (lock.rows[0]?.status !== 'RUNNING') return { terminal: true };
      const terminal = job.attempt >= job.maxAttempts;
      const retryInSeconds = retryDelaySeconds(job.attempt);
      await client.query(
        `UPDATE workflow.jobs SET status = $2, run_after = now() + ($3 * interval '1 second'),
                locked_at = NULL, locked_by = NULL, last_error = $4,
                completed_at = CASE WHEN $2 = 'FAILED' THEN now() ELSE NULL END
         WHERE id = $1`,
        [job.id, terminal ? 'FAILED' : 'RETRY_WAIT', retryInSeconds, error],
      );
      if (terminal) {
        const correlationId = randomUUID();
        await client.query(
          `UPDATE assets.asset_records SET status = 'FAILED', processing_error = $2 WHERE id = $1`,
          [job.assetId, error],
        );
        await client.query(
          `INSERT INTO assets.status_history (
             workspace_id, asset_id, from_status, to_status, reason, correlation_id
           ) VALUES ($1,$2,'PROCESSING','FAILED',$3,$4)`,
          [job.workspaceId, job.assetId, error, correlationId],
        );
      }
      await client.query(
        `INSERT INTO workflow.events (workspace_id, asset_id, event_type, payload)
         VALUES ($1,$2,$3,$4)`,
        [
          job.workspaceId,
          job.assetId,
          terminal ? 'PROCESSING_FAILED' : 'PROCESSING_RETRY_SCHEDULED',
          JSON.stringify({ jobId: job.id, attempt: job.attempt, error, retryInSeconds }),
        ],
      );
      return terminal ? { terminal: true } : { terminal: false, retryInSeconds };
    });
  }

  async recoverStale(): Promise<number> {
    const result = await this.database.query<{ recovered: number }>(
      'SELECT workflow.recover_stale_jobs() AS recovered',
    );
    return result.rows[0]?.recovered ?? 0;
  }

  async queuedCount(): Promise<number> {
    const result = await this.database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM workflow.jobs
       WHERE status IN ('QUEUED', 'RETRY_WAIT') AND run_after <= now()`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
