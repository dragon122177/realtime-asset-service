import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export class OperationalMetrics {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<'method' | 'route' | 'status_code'>;
  readonly uploads: Counter<'result' | 'format'>;
  readonly processorJobs: Counter<'result'>;
  readonly processingDuration: Histogram<'result'>;
  readonly queuedJobs: Gauge;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'forgeflow_' });
    this.httpDuration = new Histogram({
      name: 'forgeflow_http_request_duration_seconds',
      help: 'HTTP request latency by route.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
    this.uploads = new Counter({
      name: 'forgeflow_asset_uploads_total',
      help: 'Asset upload outcomes.',
      labelNames: ['result', 'format'],
      registers: [this.registry],
    });
    this.processorJobs = new Counter({
      name: 'forgeflow_processor_jobs_total',
      help: 'Processor job outcomes.',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.processingDuration = new Histogram({
      name: 'forgeflow_processing_duration_seconds',
      help: 'End-to-end processing duration.',
      labelNames: ['result'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });
    this.queuedJobs = new Gauge({
      name: 'forgeflow_queued_jobs',
      help: 'Jobs ready to be claimed.',
      registers: [this.registry],
    });
  }
}
