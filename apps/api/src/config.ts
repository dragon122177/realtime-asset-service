import { z } from 'zod';

const booleanValue = z.preprocess((value) => {
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  return value;
}, z.boolean());

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://forgeflow:forgeflow@localhost:5432/forgeflow'),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).default('local-only-forgeflow-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  LIVE_TICKET_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
  STORAGE_DRIVER: z.enum(['filesystem', 's3']).default('filesystem'),
  STORAGE_ROOT: z.string().default('./storage'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('forgeflow-assets'),
  S3_ACCESS_KEY: z.string().default('forgeflow'),
  S3_SECRET_KEY: z.string().default('local-only-minio-secret'),
  S3_USE_SSL: booleanValue.default(false),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(500 * 1024 * 1024)
    .default(50 * 1024 * 1024),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
  WORKER_METRICS_PORT: z.coerce.number().int().min(1).max(65_535).default(9092),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(4),
  PROCESSOR_VERSION: z.string().min(3).default('forgeflow-analyzer-1.0.0'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  corsOrigins: string[];
  databaseUrl: string;
  redisUrl?: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  liveTicketTtlSeconds: number;
  storage: {
    driver: 'filesystem' | 's3';
    root: string;
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    useSsl: boolean;
  };
  maxUploadBytes: number;
  workerPollMs: number;
  workerMetricsPort: number;
  workerMaxAttempts: number;
  processorVersion: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const value = environmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    logLevel: value.LOG_LEVEL,
    corsOrigins: value.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    databaseUrl: value.DATABASE_URL,
    ...(value.REDIS_URL ? { redisUrl: value.REDIS_URL } : {}),
    jwtSecret: value.JWT_SECRET,
    jwtExpiresIn: value.JWT_EXPIRES_IN,
    liveTicketTtlSeconds: value.LIVE_TICKET_TTL_SECONDS,
    storage: {
      driver: value.STORAGE_DRIVER,
      root: value.STORAGE_ROOT,
      endpoint: value.S3_ENDPOINT,
      region: value.S3_REGION,
      bucket: value.S3_BUCKET,
      accessKey: value.S3_ACCESS_KEY,
      secretKey: value.S3_SECRET_KEY,
      useSsl: value.S3_USE_SSL,
    },
    maxUploadBytes: value.MAX_UPLOAD_BYTES,
    workerPollMs: value.WORKER_POLL_MS,
    workerMetricsPort: value.WORKER_METRICS_PORT,
    workerMaxAttempts: value.WORKER_MAX_ATTEMPTS,
    processorVersion: value.PROCESSOR_VERSION,
  };
}
