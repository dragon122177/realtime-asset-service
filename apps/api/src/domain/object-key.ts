import { createHash } from 'node:crypto';

export function safeSegment(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'asset';
}

export function sourceObjectKey(input: {
  workspaceId: string;
  projectId: string;
  sha256: string;
  filename: string;
}): string {
  const extension = input.filename.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf';
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/sources/${input.sha256}.${extension}`;
}

export function deliveryObjectKey(input: {
  workspaceId: string;
  projectId: string;
  assetId: string;
  processorVersion: string;
  deliveryHash: string;
  format: 'GLTF' | 'GLB';
}): string {
  const processor = createHash('sha256').update(input.processorVersion).digest('hex').slice(0, 12);
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/delivery/${input.assetId}/${processor}/${input.deliveryHash}.${input.format.toLowerCase()}`;
}
