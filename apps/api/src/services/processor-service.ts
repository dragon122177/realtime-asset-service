import { createHash } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { analyzeGltf } from '../domain/gltf-analyzer.js';
import { deliveryObjectKey } from '../domain/object-key.js';
import { evaluateQuality } from '../domain/quality-policy.js';
import type { OperationalMetrics } from './metrics.js';
import type { ObjectStore } from './object-store.js';
import type { RealtimeHub } from './realtime-hub.js';
import type { ClaimedJob, WorkerRepository } from './worker-repository.js';

export class ProcessorService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: WorkerRepository,
    private readonly store: ObjectStore,
    private readonly realtime: RealtimeHub,
    private readonly metrics: OperationalMetrics,
  ) {}

  async process(job: ClaimedJob): Promise<void> {
    const stopTimer = this.metrics.processingDuration.startTimer();
    try {
      const source = await this.store.get(job.sourceObjectKey);
      const parsed = analyzeGltf(source, job.sourceFilename);
      const quality = evaluateQuality(parsed.analysis);
      const deliveryHash = createHash('sha256').update(parsed.deliveryBytes).digest('hex');
      const objectKey = deliveryObjectKey({
        workspaceId: job.workspaceId,
        projectId: job.projectId,
        assetId: job.assetId,
        processorVersion: this.config.processorVersion,
        deliveryHash,
        format: parsed.analysis.format,
      });
      await this.store.put(objectKey, parsed.deliveryBytes, job.contentType);
      const versionId = await this.repository.complete({
        job,
        deliveryObjectKey: objectKey,
        deliveryHash,
        deliveryBytes: parsed.deliveryBytes.length,
        processorVersion: this.config.processorVersion,
        analysis: parsed.analysis,
        quality,
      });
      this.metrics.processorJobs.inc({ result: 'succeeded' });
      stopTimer({ result: 'succeeded' });
      await this.realtime.publish({
        workspaceId: job.workspaceId,
        assetId: job.assetId,
        eventType: 'PROCESSING_COMPLETED',
        occurredAt: new Date().toISOString(),
        payload: { versionId, qualityScore: quality.score, qualityDecision: quality.decision },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'processor_failed';
      const outcome = await this.repository.fail(job, message);
      this.metrics.processorJobs.inc({ result: outcome.terminal ? 'failed' : 'retry' });
      stopTimer({ result: outcome.terminal ? 'failed' : 'retry' });
      await this.realtime.publish({
        workspaceId: job.workspaceId,
        assetId: job.assetId,
        eventType: outcome.terminal ? 'PROCESSING_FAILED' : 'PROCESSING_RETRY_SCHEDULED',
        occurredAt: new Date().toISOString(),
        payload: { attempt: job.attempt, error: message, retryInSeconds: outcome.retryInSeconds },
      });
    }
  }
}
