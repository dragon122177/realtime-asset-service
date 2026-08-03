import { describe, expect, it } from 'vitest';
import { defaultQualityBudgets, evaluateQuality } from '../domain/quality-policy.js';
import type { AssetAnalysis } from '../domain/types.js';

const healthy: AssetAnalysis = {
  format: 'GLB',
  generator: 'test',
  version: '2.0',
  sourceBytes: 1000,
  sceneCount: 1,
  nodeCount: 3,
  meshCount: 1,
  primitiveCount: 1,
  materialCount: 0,
  textureCount: 0,
  imageCount: 0,
  animationCount: 0,
  skinCount: 0,
  accessorCount: 3,
  estimatedTriangles: 12,
  externalResourceCount: 0,
  hasNormals: true,
  hasTangents: false,
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
};

describe('evaluateQuality', () => {
  it('passes a compact self-contained asset', () => {
    expect(evaluateQuality(healthy)).toEqual({ score: 100, decision: 'PASS', findings: [] });
  });

  it('sends warning-level geometry and packaging findings to review', () => {
    const report = evaluateQuality({
      ...healthy,
      materialCount: 1,
      estimatedTriangles: defaultQualityBudgets.warningTriangles + 1,
      primitiveCount: defaultQualityBudgets.warningPrimitives + 1,
      sourceBytes: defaultQualityBudgets.warningBytes + 1,
      hasNormals: false,
      bounds: null,
    });
    expect(report.decision).toBe('REVIEW');
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'HIGH_TRIANGLE_COUNT',
        'HIGH_DRAW_CALL_COUNT',
        'LARGE_SOURCE',
        'MISSING_NORMALS',
        'MISSING_TANGENTS',
        'MISSING_BOUNDS',
      ]),
    );
    expect(report.score).toBeGreaterThan(0);
  });

  it('blocks empty, external, or over-budget delivery candidates', () => {
    const report = evaluateQuality({
      ...healthy,
      meshCount: 0,
      primitiveCount: defaultQualityBudgets.maximumPrimitives + 1,
      estimatedTriangles: defaultQualityBudgets.maximumTriangles + 1,
      sourceBytes: defaultQualityBudgets.maximumBytes + 1,
      externalResourceCount: 2,
      hasNormals: false,
    });
    expect(report.decision).toBe('BLOCK');
    expect(report.score).toBe(0);
    expect(
      report.findings.filter((finding) => finding.severity === 'ERROR').length,
    ).toBeGreaterThan(3);
  });
});
