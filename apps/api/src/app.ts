import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import type { Database } from './database/client.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerAssetRoutes } from './routes/assets.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerLiveRoute } from './routes/live.js';
import { registerReviewRoutes } from './routes/reviews.js';
import { AuthService } from './services/auth-service.js';
import { ControlPlaneRepository } from './services/control-plane-repository.js';
import type { OperationalMetrics } from './services/metrics.js';
import type { ObjectStore } from './services/object-store.js';
import type { RealtimeHub } from './services/realtime-hub.js';

export type AppDependencies = {
  config: AppConfig;
  database: Database;
  store: ObjectStore;
  realtime: RealtimeHub;
  metrics: OperationalMetrics;
};

function validCorrelationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { config, database, store, realtime, metrics } = dependencies;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.query.ticket',
          'password',
          '*.password',
          '*.secretKey',
          '*.objectKey',
        ],
        censor: '[REDACTED]',
      },
    },
    trustProxy: true,
    bodyLimit: config.maxUploadBytes + 1024 * 1024,
  });

  app.decorateRequest('correlationId', '');
  app.decorateRequest('user', undefined);
  app.addHook('onRequest', async (request, reply) => {
    const supplied = request.headers['x-correlation-id'];
    request.correlationId = validCorrelationId(supplied) ? supplied : randomUUID();
    reply.header('x-correlation-id', request.correlationId);
  });

  await app.register(cors, { origin: config.corsOrigins, credentials: false });
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 10, parts: 12 },
  });

  const auth = new AuthService(database, config);
  const repository = new ControlPlaneRepository(database);

  app.addHook('onResponse', async (request, reply) => {
    metrics.httpDuration.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? 'unmatched',
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
  });

  registerHealthRoutes(app, database, store, metrics);
  registerAuthRoutes(app, auth);
  registerDashboardRoutes(app, auth, repository);
  registerAssetRoutes(app, { config, auth, repository, store, realtime, metrics });
  registerJobRoutes(app, auth, repository);
  registerReviewRoutes(app, auth, repository);
  registerAuditRoutes(app, auth, repository);
  registerLiveRoute(app, auth, realtime);
  registerErrorHandler(app);
  return app;
}
