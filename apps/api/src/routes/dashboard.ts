import type { FastifyInstance } from 'fastify';
import { authenticate, currentUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import type { ControlPlaneRepository } from '../services/control-plane-repository.js';

export function registerDashboardRoutes(
  app: FastifyInstance,
  auth: AuthService,
  repository: ControlPlaneRepository,
): void {
  app.get('/api/v1/dashboard', { preHandler: authenticate(auth) }, async (request) =>
    repository.dashboard(currentUser(request).workspaceId),
  );
  app.get('/api/v1/projects', { preHandler: authenticate(auth) }, async (request) => ({
    projects: await repository.listProjects(currentUser(request).workspaceId),
  }));
}
