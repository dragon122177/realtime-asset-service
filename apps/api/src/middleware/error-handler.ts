import { ZodError } from 'zod';
import type { FastifyInstance } from 'fastify';
import { HttpError } from '../services/http-error.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
        correlationId: request.correlationId,
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: error.issues,
        },
        correlationId: request.correlationId,
      });
    }
    const errorCode =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
    if (errorCode === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({
        error: { code: 'UPLOAD_TOO_LARGE', message: 'The asset exceeds the upload limit.' },
        correlationId: request.correlationId,
      });
    }
    request.log.error({ err: error, correlationId: request.correlationId }, 'request failed');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' },
      correlationId: request.correlationId,
    });
  });
}
