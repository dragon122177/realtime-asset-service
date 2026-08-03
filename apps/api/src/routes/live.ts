import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../services/auth-service.js';
import { HttpError } from '../services/http-error.js';
import type { RealtimeHub } from '../services/realtime-hub.js';

const ticketSchema = z.object({ ticket: z.string().min(20) });

export function registerLiveRoute(
  app: FastifyInstance,
  auth: AuthService,
  realtime: RealtimeHub,
): void {
  app.get('/api/v1/live', async (request, reply) => {
    const { ticket } = ticketSchema.parse(request.query);
    let session;
    try {
      session = await auth.verifyLiveTicket(ticket);
    } catch {
      throw new HttpError(401, 'INVALID_LIVE_TICKET', 'The realtime ticket is invalid or expired.');
    }
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`,
    );
    const unsubscribe = realtime.subscribe((event) => {
      if (event.workspaceId === session.workspaceId && !reply.raw.destroyed) {
        reply.raw.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
      }
    });
    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(': heartbeat\n\n');
    }, 20_000);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
