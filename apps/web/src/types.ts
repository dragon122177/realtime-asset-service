export type Role = 'ADMIN' | 'ARTIST' | 'REVIEWER' | 'VIEWER';
export type AssetStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export type User = {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: Role;
};

export type Project = {
  id: string;
  projectKey: string;
  name: string;
  description: string;
  qualityPolicy: Record<string, unknown>;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AssetMetrics = {
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

export type AssetSummary = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  sourceFilename: string;
  contentType: string;
  sourceBytes: string;
  status: AssetStatus;
  tags: string[];
  processingError: string | null;
  currentVersionId: string | null;
  rowVersion: number;
  qualityScore: number | null;
  qualityDecision: 'PASS' | 'REVIEW' | 'BLOCK' | null;
  metrics: AssetMetrics | null;
  findings: QualityFinding[] | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetVersion = {
  id: string;
  versionNumber: number;
  kind: 'SOURCE' | 'DELIVERY';
  contentType: string;
  byteSize: string;
  sha256: string;
  processorVersion: string | null;
  manifest: Record<string, unknown>;
  createdAt: string;
};

export type AssetDetail = AssetSummary & {
  versions: AssetVersion[];
  history: Array<{
    fromStatus: AssetStatus | null;
    toStatus: AssetStatus;
    reason: string;
    changedAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type Dashboard = {
  assets: {
    total: number;
    byStatus: Partial<Record<AssetStatus, number>>;
    published: number;
    needsAttention: number;
  };
  jobs: { queued: number; running: number; failed: number };
  pendingReviews: number;
  projects: number;
  activity: Array<{
    id: string;
    eventType: string;
    assetId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type Job = {
  id: string;
  assetId: string;
  assetName: string;
  jobType: string;
  status: 'QUEUED' | 'RUNNING' | 'RETRY_WAIT' | 'SUCCEEDED' | 'FAILED';
  priority: number;
  attempt: number;
  maxAttempts: number;
  runAfter: string;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type Review = {
  id: string;
  assetId: string;
  versionId: string;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  summary: string;
  assetName: string;
  sourceFilename: string;
  projectId: string;
  projectName: string;
  qualityScore: number;
  qualityDecision: 'PASS' | 'REVIEW' | 'BLOCK';
  metrics: AssetMetrics;
  findings: QualityFinding[];
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  context: Record<string, unknown>;
  occurredAt: string;
  actorName: string;
};
