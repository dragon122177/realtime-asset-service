import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorize, currentUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

const listSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED']).default('PENDING'),
});
const idSchema = z.object({ id: z.string().uuid() });
const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  summary: z.string().trim().max(1000).default(''),
});

export function registerReviewRoutes(
  app: FastifyInstance,
  auth: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get('/api/v1/reviews', { preHandler: authenticate(auth) }, async (request) => {
    const { status } = listSchema.parse(request.query);
    return { reviews: await repository.listReviews(currentUser(request).workspaceId, status) };
  });

  app.post(
    '/api/v1/reviews/:id/decision',
    { preHandler: [authenticate(auth), authorize('ADMIN', 'REVIEWER')] },
    async (request) => {
      const { id } = idSchema.parse(request.params);
      const input = decisionSchema.parse(request.body);
      const actor = currentUser(request);
      await repository.decideReview({
        workspaceId: actor.workspaceId,
        reviewId: id,
        ...input,
        actor,
        correlationId: request.correlationId,
      });
      return { status: input.decision.toLowerCase() };
    },
  );
}
