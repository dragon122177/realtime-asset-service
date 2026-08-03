import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Client as MinioClient } from 'minio';
import type { AppConfig } from '../config.js';

export type StoredObject = {
  bytes: number;
  etag?: string;
  contentType?: string;
};

export interface ObjectStore {
  initialize(): Promise<void>;
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  stat(key: string): Promise<StoredObject>;
}

export class FilesystemObjectStore implements ObjectStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) {
      throw new Error('unsafe_object_key');
    }
    return path;
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' }).catch(async (error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(path);
      if (!existing.equals(body)) throw new Error('object_key_collision');
    });
    await writeFile(`${path}.metadata.json`, JSON.stringify({ contentType }), { flag: 'w' });
    return { bytes: body.length, contentType };
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async stat(key: string): Promise<StoredObject> {
    const value = await stat(this.pathFor(key));
    return { bytes: value.size };
  }
}

export class S3ObjectStore implements ObjectStore {
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly region: string;

  constructor(config: AppConfig['storage']) {
    const endpoint = new URL(config.endpoint);
    this.client = new MinioClient({
      endPoint: endpoint.hostname,
      port: endpoint.port ? Number(endpoint.port) : config.useSsl ? 443 : 80,
      useSSL: config.useSsl,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
    this.bucket = config.bucket;
    this.region = config.region;
  }

  async initialize(): Promise<void> {
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket, this.region);
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const result = await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': contentType,
    });
    return { bytes: body.length, etag: result.etag, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
  }

  async stat(key: string): Promise<StoredObject> {
    const value = await this.client.statObject(this.bucket, key);
    return {
      bytes: value.size,
      etag: value.etag,
      contentType: value.metaData['content-type'] as string | undefined,
    };
  }
}

export function createObjectStore(config: AppConfig): ObjectStore {
  return config.storage.driver === 's3'
    ? new S3ObjectStore(config.storage)
    : new FilesystemObjectStore(config.storage.root);
}
