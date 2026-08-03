import type { AssetAnalysis, QualityFinding, QualityReport } from './types.js';

export type QualityBudgets = {
  warningTriangles: number;
  maximumTriangles: number;
  warningPrimitives: number;
  maximumPrimitives: number;
  warningBytes: number;
  maximumBytes: number;
};

export const defaultQualityBudgets: QualityBudgets = {
  warningTriangles: 100_000,
  maximumTriangles: 500_000,
  warningPrimitives: 200,
  maximumPrimitives: 1000,
  warningBytes: 25 * 1024 * 1024,
  maximumBytes: 50 * 1024 * 1024,
};

export function evaluateQuality(
  analysis: AssetAnalysis,
  budgets: QualityBudgets = defaultQualityBudgets,
): QualityReport {
  const findings: QualityFinding[] = [];
  let score = 100;

  const add = (finding: QualityFinding, deduction: number): void => {
    findings.push(finding);
    score -= deduction;
  };

  if (analysis.meshCount === 0 || analysis.primitiveCount === 0) {
    add(
      {
        code: 'EMPTY_SCENE',
        severity: 'ERROR',
        message: 'No renderable mesh primitives were found.',
      },
      100,
    );
  }
  if (analysis.externalResourceCount > 0) {
    add(
      {
        code: 'EXTERNAL_RESOURCES',
        severity: 'ERROR',
        message: 'The source references external buffers or images and is not self-contained.',
        metric: analysis.externalResourceCount,
        budget: 0,
      },
      35,
    );
  }
  if (analysis.estimatedTriangles > budgets.maximumTriangles) {
    add(
      {
        code: 'TRIANGLE_BUDGET_EXCEEDED',
        severity: 'ERROR',
        message: 'Estimated triangle count exceeds the delivery budget.',
        metric: analysis.estimatedTriangles,
        budget: budgets.maximumTriangles,
      },
      30,
    );
  } else if (analysis.estimatedTriangles > budgets.warningTriangles) {
    add(
      {
        code: 'HIGH_TRIANGLE_COUNT',
        severity: 'WARNING',
        message: 'Triangle count should be reviewed for realtime delivery.',
        metric: analysis.estimatedTriangles,
        budget: budgets.warningTriangles,
      },
      12,
    );
  }
  if (analysis.primitiveCount > budgets.maximumPrimitives) {
    add(
      {
        code: 'DRAW_CALL_BUDGET_EXCEEDED',
        severity: 'ERROR',
        message: 'Primitive count exceeds the maximum draw-call budget.',
        metric: analysis.primitiveCount,
        budget: budgets.maximumPrimitives,
      },
      25,
    );
  } else if (analysis.primitiveCount > budgets.warningPrimitives) {
    add(
      {
        code: 'HIGH_DRAW_CALL_COUNT',
        severity: 'WARNING',
        message: 'Primitive count may produce excessive draw calls.',
        metric: analysis.primitiveCount,
        budget: budgets.warningPrimitives,
      },
      10,
    );
  }
  if (analysis.sourceBytes > budgets.maximumBytes) {
    add(
      {
        code: 'FILE_BUDGET_EXCEEDED',
        severity: 'ERROR',
        message: 'Source size exceeds the configured upload budget.',
        metric: analysis.sourceBytes,
        budget: budgets.maximumBytes,
      },
      25,
    );
  } else if (analysis.sourceBytes > budgets.warningBytes) {
    add(
      {
        code: 'LARGE_SOURCE',
        severity: 'WARNING',
        message: 'Source size should be reduced before delivery.',
        metric: analysis.sourceBytes,
        budget: budgets.warningBytes,
      },
      8,
    );
  }
  if (!analysis.hasNormals) {
    add(
      {
        code: 'MISSING_NORMALS',
        severity: 'WARNING',
        message: 'One or more primitives have no normals.',
      },
      8,
    );
  }
  if (!analysis.hasTangents && analysis.materialCount > 0) {
    add(
      {
        code: 'MISSING_TANGENTS',
        severity: 'INFO',
        message: 'Tangents are absent; review normal-mapped materials.',
      },
      2,
    );
  }
  if (!analysis.bounds) {
    add(
      {
        code: 'MISSING_BOUNDS',
        severity: 'INFO',
        message: 'POSITION accessors do not declare bounds.',
      },
      2,
    );
  }

  score = Math.max(0, Math.min(100, score));
  const decision = findings.some((finding) => finding.severity === 'ERROR')
    ? 'BLOCK'
    : findings.some((finding) => finding.severity === 'WARNING') || score < 90
      ? 'REVIEW'
      : 'PASS';
  return { score, decision, findings };
}
