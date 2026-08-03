export const roles = ['ADMIN', 'ARTIST', 'REVIEWER', 'VIEWER'] as const;
export type Role = (typeof roles)[number];

export const assetStatuses = [
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'FAILED',
  'ARCHIVED',
] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export const jobStatuses = ['QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED'] as const;
export type JobStatus = (typeof jobStatuses)[number];

export type AuthenticatedUser = {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: Role;
};

export type AssetAnalysis = {
  format: 'GLTF' | 'GLB';
  generator: string | null;
  version: string;
  sourceBytes: number;
  sceneCount: number;
  nodeCount: number;
  meshCount: number;
  primitiveCount: number;
  materialCount: number;
  textureCount: number;
  imageCount: number;
  animationCount: number;
  skinCount: number;
  accessorCount: number;
  estimatedTriangles: number;
  externalResourceCount: number;
  hasNormals: boolean;
  hasTangents: boolean;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
};

export type QualityFinding = {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  metric?: number;
  budget?: number;
};

export type QualityReport = {
  score: number;
  decision: 'PASS' | 'REVIEW' | 'BLOCK';
  findings: QualityFinding[];
};
