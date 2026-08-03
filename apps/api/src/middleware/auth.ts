import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../domain/types.js';
import type { AuthService } from '../services/auth-service.js';
import { HttpError } from '../services/http-error.js';

export function authenticate(auth: AuthService) {
  return async (request: FastifyRequest): Promise<void> => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'A bearer token is required.');
    }
    try {
      request.user = await auth.verify(header.slice(7));
    } catch {
      throw new HttpError(401, 'INVALID_TOKEN', 'The bearer token is invalid or expired.');
    }
  };
}

export function authorize(...allowed: Role[]) {
  return (request: FastifyRequest, _reply: FastifyReply): void => {
    if (!request.user || !allowed.includes(request.user.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'This role cannot perform the requested operation.');
    }
  };
}

export function currentUser(request: FastifyRequest) {
  if (!request.user)
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
  return request.user;
}
