import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from './client.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

async function migrationDirectory(): Promise<string> {
  const candidates = [
    resolve(process.cwd(), 'database/migrations'),
    resolve(process.cwd(), '../../database/migrations'),
    resolve(moduleDirectory, '../../../../database/migrations'),
    resolve(moduleDirectory, '../../../database/migrations'),
  ];
  for (const candidate of candidates) {
    try {
      const files = await readdir(candidate);
      if (files.some((file) => file.endsWith('.sql'))) return candidate;
    } catch {
      // Continue through layouts used by source, workspace scripts, and bundled output.
    }
  }
  throw new Error('Unable to locate database/migrations');
}

export async function migrateDatabase(database: Database): Promise<string[]> {
  const directory = await migrationDirectory();
  const files = (await readdir(directory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  const applied: string[] = [];

  await database.transaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('forgeflow:migrations'))`);
    await client.query('CREATE SCHEMA IF NOT EXISTS platform');
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform.schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const filename of files) {
      const sql = await readFile(join(directory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM platform.schema_migrations WHERE filename = $1',
        [filename],
      );
      if (existing.rowCount) {
        if (existing.rows[0]?.checksum !== checksum) {
          throw new Error(`Migration checksum changed: ${filename}`);
        }
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO platform.schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      );
      applied.push(filename);
    }
  });
  return applied;
}
