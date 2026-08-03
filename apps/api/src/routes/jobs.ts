import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorize, currentUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

const idSchema = z.object({ id: z.string().uuid() });

export function registerJobRoutes(
  app: FastifyInstance,
  auth: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get('/api/v1/jobs', { preHandler: authenticate(auth) }, async (request) => ({
    jobs: await repository.listJobs(currentUser(request).workspaceId),
  }));

  app.post(
    '/api/v1/jobs/:id/retry',
    { preHandler: [authenticate(auth), authorize('ADMIN', 'ARTIST')] },
    async (request, reply) => {
      const { id } = idSchema.parse(request.params);
      const actor = currentUser(request);
      await repository.retryJob({
        workspaceId: actor.workspaceId,
        jobId: id,
        actor,
        correlationId: request.correlationId,
      });
      return reply.status(202).send({ status: 'queued' });
    },
  );
}
