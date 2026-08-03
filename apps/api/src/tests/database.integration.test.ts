import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../database/client.js';
import { migrateDatabase } from '../database/migrator.js';
import { WorkerRepository } from '../services/worker-repository.js';

const connectionString = process.env.TEST_DATABASE_URL;
const suite = connectionString ? describe.sequential : describe.skip;
const database = connectionString ? new Database(connectionString) : undefined;

afterAll(async () => database?.close());

async function fixture() {
  if (!database) throw new Error('database unavailable');
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const assetId = randomUUID();
  const hash = createHash('sha256').update(assetId).digest('hex');
  await database.query('INSERT INTO identity.workspaces (id, slug, name) VALUES ($1,$2,$3)', [
    workspaceId,
    `workspace-${workspaceId}`,
    'Integration workspace',
  ]);
  await database.query(
    `INSERT INTO identity.users (id, workspace_id, email, password_hash, display_name, role)
     VALUES ($1,$2,$3,'not-used','Test Operator','ADMIN')`,
    [userId, workspaceId, `${userId}@example.test`],
  );
  await database.query(
    `INSERT INTO assets.projects (id, workspace_id, project_key, name)
     VALUES ($1,$2,$3,'Integration project')`,
    [projectId, workspaceId, `project-${projectId}`],
  );
  await database.query(
    `INSERT INTO assets.asset_records (
       id, workspace_id, project_id, name, source_filename, content_type, source_hash,
       source_object_key, source_bytes, status, created_by
     ) VALUES ($1,$2,$3,'Cube','cube.gltf','model/gltf+json',$4,$5,100,'UPLOADED',$6)`,
    [assetId, workspaceId, projectId, hash, `sources/${assetId}.gltf`, userId],
  );
  return { workspaceId, userId, projectId, assetId, hash };
}

suite('PostgreSQL integration', () => {
  it('applies checksum-protected migrations idempotently', async () => {
    if (!database) return;
    await migrateDatabase(database);
    expect(await migrateDatabase(database)).toEqual([]);
    const schemas = await database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM information_schema.schemata
       WHERE schema_name IN ('identity','assets','workflow','audit')`,
    );
    expect(Number(schemas.rows[0]?.count)).toBe(4);
  });

  it('enforces the asset lifecycle in PostgreSQL', async () => {
    const item = await fixture();
    if (!database) return;
    await database.query(`UPDATE assets.asset_records SET status = 'QUEUED' WHERE id = $1`, [
      item.assetId,
    ]);
    await expect(
      database.query(`UPDATE assets.asset_records SET status = 'PUBLISHED' WHERE id = $1`, [
        item.assetId,
      ]),
    ).rejects.toThrow(/invalid asset transition/);
  });

  it('claims a queued job exactly once with SKIP LOCKED semantics', async () => {
    const item = await fixture();
    if (!database) return;
    await database.query(`UPDATE assets.asset_records SET status = 'QUEUED' WHERE id = $1`, [
      item.assetId,
    ]);
    await database.query(
      `INSERT INTO workflow.jobs (
         workspace_id, asset_id, job_type, status, idempotency_key
       ) VALUES ($1,$2,'ANALYZE_AND_PACKAGE','QUEUED',$3)`,
      [item.workspaceId, item.assetId, `${item.assetId}:integration`],
    );
    const workers = new WorkerRepository(database);
    const [first, second] = await Promise.all([
      workers.claim('worker-a'),
      workers.claim('worker-b'),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(first ?? second).toMatchObject({ assetId: item.assetId, attempt: 1 });
  });

  it('protects audit evidence from updates and deletes', async () => {
    const item = await fixture();
    if (!database) return;
    const inserted = await database.query<{ id: string }>(
      `INSERT INTO audit.events (
         workspace_id, actor_id, action, target_type, target_id, correlation_id
       ) VALUES ($1,$2,'asset.tested','asset',$3,$4) RETURNING id::text`,
      [item.workspaceId, item.userId, item.assetId, randomUUID()],
    );
    await expect(
      database.query(`UPDATE audit.events SET action = 'changed' WHERE id = $1`, [
        inserted.rows[0]?.id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      database.query('DELETE FROM audit.events WHERE id = $1', [inserted.rows[0]?.id]),
    ).rejects.toThrow(/append-only/);
  });

  it('installs tenant policies on every governed table', async () => {
    if (!database) return;
    const result = await database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_policies
       WHERE policyname LIKE '%workspace_policy'`,
    );
    expect(Number(result.rows[0]?.count)).toBeGreaterThanOrEqual(10);
  });
});
