import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { Database } from './database/client.js';
import { OperationalMetrics } from './services/metrics.js';
import { createObjectStore } from './services/object-store.js';
import { RealtimeHub } from './services/realtime-hub.js';

const config = loadConfig();
const database = new Database(config.databaseUrl);
const store = createObjectStore(config);
const realtime = new RealtimeHub(config.redisUrl);
const metrics = new OperationalMetrics();

await store.initialize();
await realtime.connect();
const app = await buildApp({ config, database, store, realtime, metrics });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await realtime.close();
  await database.close();
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal(error);
  await realtime.close();
  await database.close();
  process.exitCode = 1;
}
