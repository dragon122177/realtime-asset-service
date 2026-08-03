import { createServer } from 'node:http';
import { hostname } from 'node:os';
import pino from 'pino';
import { loadConfig } from './config.js';
import { Database } from './database/client.js';
import { OperationalMetrics } from './services/metrics.js';
import { createObjectStore } from './services/object-store.js';
import { ProcessorService } from './services/processor-service.js';
import { RealtimeHub } from './services/realtime-hub.js';
import { WorkerRepository } from './services/worker-repository.js';

const config = loadConfig();
const logger = pino({ level: config.logLevel, name: 'forgeflow-worker' });
const database = new Database(config.databaseUrl);
const store = createObjectStore(config);
const realtime = new RealtimeHub(config.redisUrl);
const metrics = new OperationalMetrics();
const repository = new WorkerRepository(database);
const processor = new ProcessorService(config, repository, store, realtime, metrics);
const workerId = `${hostname()}:${process.pid}`;
let stopping = false;
const metricsServer = createServer((request, response) => {
  if (request.url === '/health/live') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (request.url === '/metrics') {
    void metrics.registry
      .metrics()
      .then((body) => {
        response.writeHead(200, { 'content-type': metrics.registry.contentType });
        response.end(body);
      })
      .catch(() => {
        response.writeHead(500);
        response.end();
      });
    return;
  }
  response.writeHead(404);
  response.end();
});

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function run(): Promise<void> {
  await store.initialize();
  await realtime.connect();
  await new Promise<void>((resolve, reject) => {
    metricsServer.once('error', reject);
    metricsServer.listen(config.workerMetricsPort, config.host, () => {
      metricsServer.removeListener('error', reject);
      resolve();
    });
  });
  const recovered = await repository.recoverStale();
  logger.info({ workerId, recovered, metricsPort: config.workerMetricsPort }, 'worker started');
  let lastRecovery = Date.now();
  while (!stopping) {
    metrics.queuedJobs.set(await repository.queuedCount());
    const job = await repository.claim(workerId);
    if (job) {
      logger.info({ jobId: job.id, assetId: job.assetId, attempt: job.attempt }, 'job claimed');
      await processor.process(job);
    } else {
      await delay(config.workerPollMs);
    }
    if (Date.now() - lastRecovery > 60_000) {
      const stale = await repository.recoverStale();
      if (stale) logger.warn({ stale }, 'recovered expired worker leases');
      lastRecovery = Date.now();
    }
  }
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'worker stopping');
  if (metricsServer.listening) {
    await new Promise<void>((resolve, reject) => {
      metricsServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await realtime.close();
  await database.close();
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  await run();
} catch (error) {
  logger.fatal({ err: error }, 'worker crashed');
  await shutdown('ERROR');
  process.exitCode = 1;
}
