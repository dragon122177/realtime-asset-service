import type { FastifyInstance } from 'fastify';
import { authenticate, authorize, currentUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

export function registerAuditRoutes(
  app: FastifyInstance,
  auth: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get(
    '/api/v1/audit',
    { preHandler: [authenticate(auth), authorize('ADMIN', 'REVIEWER')] },
    async (request) => ({ events: await repository.listAudit(currentUser(request).workspaceId) }),
  );
}
