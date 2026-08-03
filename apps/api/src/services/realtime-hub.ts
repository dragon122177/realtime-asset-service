import { EventEmitter } from 'node:events';
import Redis from 'ioredis';

export type RealtimeEvent = {
  workspaceId: string;
  assetId?: string;
  eventType: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
};

const channel = 'forgeflow:events';

export class RealtimeHub {
  private readonly local = new EventEmitter();
  private publisher?: Redis;
  private subscriber?: Redis;
  private redisReady = false;

  constructor(private readonly redisUrl?: string) {
    this.local.setMaxListeners(250);
  }

  async connect(): Promise<void> {
    if (!this.redisUrl) return;
    const options = {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt: number) => (attempt > 2 ? null : Math.min(attempt * 100, 500)),
    };
    this.publisher = new Redis(this.redisUrl, options);
    this.subscriber = new Redis(this.redisUrl, options);
    this.publisher.on('error', () => undefined);
    this.subscriber.on('error', () => undefined);
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (_channel, raw) => {
        try {
          this.local.emit('event', JSON.parse(raw) as RealtimeEvent);
        } catch {
          // Ignore malformed messages from an unexpected publisher.
        }
      });
      this.redisReady = true;
    } catch {
      this.redisReady = false;
    }
  }

  async publish(event: RealtimeEvent): Promise<void> {
    this.local.emit('event', event);
    if (this.redisReady && this.publisher) {
      await this.publisher.publish(channel, JSON.stringify(event)).catch(() => undefined);
    }
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.local.on('event', listener);
    return () => this.local.off('event', listener);
  }

  async close(): Promise<void> {
    const clients = [this.publisher, this.subscriber].filter((client): client is Redis =>
      Boolean(client),
    );
    await Promise.all(clients.map((client) => client.quit().catch(() => undefined)));
  }
}
