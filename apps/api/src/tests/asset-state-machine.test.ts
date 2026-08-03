import { describe, expect, it } from 'vitest';
import {
  assertAssetTransition,
  availableAssetTransitions,
  canTransitionAsset,
  processingTargetStatus,
} from '../domain/asset-state-machine.js';

describe('asset state machine', () => {
  it('supports the complete happy path', () => {
    const states = [
      'UPLOADED',
      'QUEUED',
      'PROCESSING',
      'READY_FOR_REVIEW',
      'APPROVED',
      'PUBLISHED',
    ] as const;
    for (let index = 0; index < states.length - 1; index += 1) {
      const from = states[index]!;
      const to = states[index + 1]!;
      expect(canTransitionAsset(from, to)).toBe(true);
      expect(() => assertAssetTransition(from, to)).not.toThrow();
    }
  });

  it('supports correction, retry, and archive paths', () => {
    expect(availableAssetTransitions('READY_FOR_REVIEW')).toEqual(
      expect.arrayContaining(['APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED']),
    );
    expect(canTransitionAsset('PROCESSING', 'CHANGES_REQUESTED')).toBe(true);
    expect(canTransitionAsset('CHANGES_REQUESTED', 'QUEUED')).toBe(true);
    expect(canTransitionAsset('FAILED', 'QUEUED')).toBe(true);
    expect(availableAssetTransitions('ARCHIVED')).toEqual([]);
  });

  it('rejects skipped and terminal transitions', () => {
    expect(canTransitionAsset('UPLOADED', 'PUBLISHED')).toBe(false);
    expect(() => assertAssetTransition('ARCHIVED', 'QUEUED')).toThrow(
      'invalid_asset_transition:ARCHIVED->QUEUED',
    );
  });

  it('routes policy blocks directly to remediation', () => {
    expect(processingTargetStatus('PASS')).toBe('READY_FOR_REVIEW');
    expect(processingTargetStatus('REVIEW')).toBe('READY_FOR_REVIEW');
    expect(processingTargetStatus('BLOCK')).toBe('CHANGES_REQUESTED');
  });
});
