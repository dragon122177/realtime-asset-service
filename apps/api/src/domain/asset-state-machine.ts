import type { AssetStatus } from './types.js';

const transitions: Record<AssetStatus, ReadonlySet<AssetStatus>> = {
  UPLOADED: new Set(['QUEUED', 'ARCHIVED']),
  QUEUED: new Set(['PROCESSING', 'FAILED', 'ARCHIVED']),
  PROCESSING: new Set(['READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'FAILED']),
  READY_FOR_REVIEW: new Set(['APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED']),
  CHANGES_REQUESTED: new Set(['QUEUED', 'ARCHIVED']),
  APPROVED: new Set(['PUBLISHED', 'QUEUED', 'ARCHIVED']),
  PUBLISHED: new Set(['QUEUED', 'ARCHIVED']),
  FAILED: new Set(['QUEUED', 'ARCHIVED']),
  ARCHIVED: new Set(),
};

export function canTransitionAsset(from: AssetStatus, to: AssetStatus): boolean {
  return transitions[from].has(to);
}

export function assertAssetTransition(from: AssetStatus, to: AssetStatus): void {
  if (!canTransitionAsset(from, to)) {
    throw new Error(`invalid_asset_transition:${from}->${to}`);
  }
}

export function availableAssetTransitions(status: AssetStatus): AssetStatus[] {
  return [...transitions[status]];
}

export function processingTargetStatus(
  decision: 'PASS' | 'REVIEW' | 'BLOCK',
): 'READY_FOR_REVIEW' | 'CHANGES_REQUESTED' {
  return decision === 'BLOCK' ? 'CHANGES_REQUESTED' : 'READY_FOR_REVIEW';
}
