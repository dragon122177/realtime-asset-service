import { describe, expect, it } from 'vitest';
import { parseByteRange } from '../domain/byte-range.js';
import { retryDelaySeconds } from '../domain/job-backoff.js';
import { deliveryObjectKey, safeSegment, sourceObjectKey } from '../domain/object-key.js';

describe('byte ranges', () => {
  it('parses full, bounded, open, and suffix ranges', () => {
    expect(parseByteRange(undefined, 100)).toBeNull();
    expect(parseByteRange('bytes=0-99', 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=50-', 100)).toEqual({ start: 50, end: 99 });
    expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=5-500', 100)).toEqual({ start: 5, end: 99 });
  });

  it.each(['items=0-5', 'bytes=-0', 'bytes=100-101', 'bytes=9-2', 'bytes=-'])(
    'rejects invalid range %s',
    (value) => {
      expect(() => parseByteRange(value, 100)).toThrow('invalid_range');
    },
  );
});

describe('object keys', () => {
  it('normalizes unsafe labels and creates deterministic scoped keys', () => {
    expect(safeSegment('  Médical Scanner / Final  ')).toBe('medical-scanner-final');
    expect(safeSegment('***')).toBe('asset');
    expect(
      sourceObjectKey({ workspaceId: 'w', projectId: 'p', sha256: 'abc', filename: 'model.GLB' }),
    ).toBe('workspaces/w/projects/p/sources/abc.glb');
    const first = deliveryObjectKey({
      workspaceId: 'w',
      projectId: 'p',
      assetId: 'a',
      processorVersion: 'v1',
      deliveryHash: 'a'.repeat(64),
      format: 'GLTF',
    });
    const second = deliveryObjectKey({
      workspaceId: 'w',
      projectId: 'p',
      assetId: 'a',
      processorVersion: 'v1',
      deliveryHash: 'a'.repeat(64),
      format: 'GLTF',
    });
    expect(first).toBe(second);
    expect(first).toMatch(/delivery\/a\/[0-9a-f]{12}\/a{64}\.gltf$/);
  });
});

describe('retry backoff', () => {
  it('uses bounded exponential delay with jitter', () => {
    expect(retryDelaySeconds(1, () => 0)).toBe(2);
    expect(retryDelaySeconds(3, () => 0.5)).toBe(8);
    expect(retryDelaySeconds(99, () => 1)).toBe(375);
    expect(retryDelaySeconds(-5, () => 0)).toBe(2);
  });
});
