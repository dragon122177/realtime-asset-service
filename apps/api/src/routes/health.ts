import type { FastifyInstance } from 'fastify';
import type { Database } from '../database/client.js';
import type { OperationalMetrics } from '../services/metrics.js';
import type { ObjectStore } from '../services/object-store.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  database: Database,
  store: ObjectStore,
  metrics: OperationalMetrics,
): void {
  app.get('/health/live', () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const databaseReady = await database.ready();
    let storageReady = true;
    try {
      await store.initialize();
    } catch {
      storageReady = false;
    }
    const ready = databaseReady && storageReady;
    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not_ready',
      dependencies: { database: databaseReady, objectStorage: storageReady },
    });
  });
  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });
}
