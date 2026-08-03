import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, currentUser } from '../middleware/auth.js';
import type { AuthService } from '../services/auth-service.js';
import { HttpError } from '../services/http-error.js';

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService): void {
  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const input = loginSchema.parse(request.body);
      try {
        return await auth.login(input.email, input.password);
      } catch {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }
    },
  );

  app.get('/api/v1/auth/me', { preHandler: authenticate(auth) }, (request) => ({
    user: currentUser(request),
  }));

  app.post('/api/v1/auth/live-ticket', { preHandler: authenticate(auth) }, (request) =>
    auth.issueLiveTicket(currentUser(request)),
  );
}
