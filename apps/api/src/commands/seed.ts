import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { loadConfig } from '../config.js';
import { Database } from '../database/client.js';
import { migrateDatabase } from '../database/migrator.js';
import { sourceObjectKey } from '../domain/object-key.js';
import type { AuthenticatedUser } from '../domain/types.js';
import { ControlPlaneRepository } from '../services/control-plane-repository.js';
import { createObjectStore } from '../services/object-store.js';
import { readSampleAsset } from '../services/sample-asset-loader.js';

const ids = {
  workspace: 'd64a75dc-285f-4d54-8c50-7ca17d9538c0',
  admin: '5f31e12b-a06b-4d24-92b4-7fb4bd390f81',
  artist: 'b3c8a13b-6ff7-451a-bd0f-1f717bc2dfca',
  reviewer: '31335c83-b7aa-47ac-9dca-8f69e0b9713f',
  viewer: 'f81aac94-8134-4b8d-8ee5-8d7d60f0ebda',
  showroom: 'b921f71e-4de7-45b3-b232-aec827ba8f0e',
  robotics: '9a1f6042-f3fb-4a7f-a65f-a9ee37c4a45c',
  medical: 'fc5504cb-a9ab-4a40-90b8-edbb1243b0d3',
};

const config = loadConfig();
const database = new Database(config.databaseUrl);
const store = createObjectStore(config);
const repository = new ControlPlaneRepository(database);

try {
  await migrateDatabase(database);
  await store.initialize();
  const passwordHash = await bcrypt.hash('ForgeFlow!2026', 12);
  await database.transaction(async (client) => {
    await client.query(
      `INSERT INTO identity.workspaces (id, slug, name) VALUES ($1,'northstar-labs','Northstar Labs')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [ids.workspace],
    );
    const users = [
      [ids.admin, 'admin@forgeflow.local', 'Mika Sato', 'ADMIN'],
      [ids.artist, 'artist@forgeflow.local', 'Ren Ito', 'ARTIST'],
      [ids.reviewer, 'reviewer@forgeflow.local', 'Aiko Mori', 'REVIEWER'],
      [ids.viewer, 'viewer@forgeflow.local', 'Noah Kim', 'VIEWER'],
    ];
    for (const [id, email, displayName, role] of users) {
      await client.query(
        `INSERT INTO identity.users (id, workspace_id, email, password_hash, display_name, role)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name, role = EXCLUDED.role, is_active = true`,
        [id, ids.workspace, email, passwordHash, displayName, role],
      );
    }
    const projects = [
      [ids.showroom, 'showroom', 'Interactive Showroom', 'Customer-facing product visualization'],
      [ids.robotics, 'robotics', 'Robotics Digital Twin', 'Realtime factory-cell review assets'],
      [ids.medical, 'medical', 'Medical Training', 'Synthetic equipment used in training scenes'],
    ];
    for (const [id, key, name, description] of projects) {
      await client.query(
        `INSERT INTO assets.projects (id, workspace_id, project_key, name, description)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [id, ids.workspace, key, name, description],
      );
    }
  });

  const actor: AuthenticatedUser = {
    id: ids.admin,
    workspaceId: ids.workspace,
    email: 'admin@forgeflow.local',
    displayName: 'Mika Sato',
    role: 'ADMIN',
  };
  const samples = [
    {
      projectId: ids.showroom,
      file: 'cube.gltf',
      name: 'Ceramic Product Cube',
      tags: ['web', 'product'],
    },
    {
      projectId: ids.robotics,
      file: 'robot-cell.gltf',
      name: 'Assembly Robot Cell',
      tags: ['robotics', 'digital-twin'],
    },
    {
      projectId: ids.medical,
      file: 'medical-scanner.gltf',
      name: 'Training Scanner',
      tags: ['medical', 'training'],
    },
  ];
  for (const sample of samples) {
    const bytes = await readSampleAsset(sample.file);
    const sourceHash = createHash('sha256').update(bytes).digest('hex');
    const objectKey = sourceObjectKey({
      workspaceId: ids.workspace,
      projectId: sample.projectId,
      sha256: sourceHash,
      filename: sample.file,
    });
    await store.put(objectKey, bytes, 'model/gltf+json');
    await repository.createAsset({
      workspaceId: ids.workspace,
      projectId: sample.projectId,
      name: sample.name,
      filename: sample.file,
      contentType: 'model/gltf+json',
      sourceHash,
      objectKey,
      byteSize: bytes.length,
      tags: sample.tags,
      maxAttempts: config.workerMaxAttempts,
      actor,
      correlationId: randomUUID(),
    });
  }
  console.log(
    'Seeded Northstar Labs, four users, three projects, and three synthetic glTF assets.',
  );
} finally {
  await database.close();
}
