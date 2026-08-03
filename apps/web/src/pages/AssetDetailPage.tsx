import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Box,
  FileCode2,
  History,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { AssetPreview } from '../components/AssetPreview';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from '../context/RouterContext';
import { api } from '../lib/api';
import { formatBytes, formatDate, formatNumber, humanize } from '../lib/format';

export function AssetDetailPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'analysis' | 'versions' | 'history'>('analysis');
  const asset = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.asset(id),
    refetchInterval: 20_000,
  });
  const reprocess = useMutation({
    mutationFn: () => api.reprocess(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['asset', id] }),
  });
  const data = asset.data;
  return (
    <>
      <Link to="/assets" className="back-link">
        <ArrowLeft size={16} /> Back to asset library
      </Link>
      <DataState loading={asset.isLoading} error={asset.error} empty={!data}>
        {data && (
          <>
            <header className="asset-detail-header">
              <div>
                <div className="eyebrow">
                  {data.projectName} · {data.sourceFilename}
                </div>
                <div className="detail-title-line">
                  <h1>{data.name}</h1>
                  <StatusBadge value={data.status} />
                </div>
                <p>
                  Created by {data.createdByName} · updated {formatDate(data.updatedAt)}
                </p>
              </div>
              <div className="page-actions">
                <button
                  className="secondary-button"
                  disabled={
                    !['FAILED', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED'].includes(
                      data.status,
                    ) || reprocess.isPending
                  }
                  onClick={() => reprocess.mutate()}
                >
                  <RefreshCw size={16} /> {reprocess.isPending ? 'Queueing…' : 'Reprocess'}
                </button>
              </div>
            </header>
            {data.processingError && (
              <div className="error-banner">
                <TriangleAlert />
                <div>
                  <strong>Processing stopped</strong>
                  <span>{data.processingError}</span>
                </div>
              </div>
            )}
            <section className="detail-hero-grid">
              <AssetPreview
                assetId={data.id}
                kind={
                  data.currentVersionId &&
                  data.versions.some((version) => version.kind === 'DELIVERY')
                    ? 'delivery'
                    : 'source'
                }
              />
              <article className="quality-card panel">
                <div className="quality-heading">
                  <div>
                    <span className="eyebrow">Delivery readiness</span>
                    <h2>Quality report</h2>
                  </div>
                  <div
                    className={`quality-score score-${(data.qualityScore ?? 0) >= 90 ? 'high' : (data.qualityScore ?? 0) >= 70 ? 'medium' : 'low'}`}
                  >
                    <strong>{data.qualityScore ?? '—'}</strong>
                    <span>/100</span>
                  </div>
                </div>
                <div className="quality-summary">
                  <StatusBadge value={data.qualityDecision ?? 'NOT_ANALYZED'} />
                  <span>{data.findings?.length ?? 0} automated findings</span>
                </div>
                <div className="finding-list">
                  {!data.findings?.length && (
                    <p className="quiet-copy">Metrics will appear after the processor finishes.</p>
                  )}
                  {data.findings?.slice(0, 5).map((finding) => (
                    <div
                      className={`finding finding-${finding.severity.toLowerCase()}`}
                      key={finding.code}
                    >
                      <span>
                        {finding.severity === 'ERROR' ? <TriangleAlert /> : <ShieldCheck />}
                      </span>
                      <div>
                        <strong>{humanize(finding.code)}</strong>
                        <p>{finding.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
            <nav className="detail-tabs">
              {(['analysis', 'versions', 'history'] as const).map((value) => (
                <button
                  key={value}
                  className={tab === value ? 'active' : ''}
                  onClick={() => setTab(value)}
                >
                  {value === 'analysis' ? (
                    <Box size={16} />
                  ) : value === 'versions' ? (
                    <FileCode2 size={16} />
                  ) : (
                    <History size={16} />
                  )}
                  {value}
                </button>
              ))}
            </nav>
            {tab === 'analysis' && (
              <section className="analysis-grid">
                <article className="panel metric-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Geometry</span>
                      <h2>Scene complexity</h2>
                    </div>
                  </div>
                  <div className="technical-metrics">
                    {[
                      ['Estimated triangles', formatNumber(data.metrics?.estimatedTriangles)],
                      ['Mesh objects', formatNumber(data.metrics?.meshCount)],
                      ['Draw-call primitives', formatNumber(data.metrics?.primitiveCount)],
                      ['Scene nodes', formatNumber(data.metrics?.nodeCount)],
                      ['Materials', formatNumber(data.metrics?.materialCount)],
                      ['Animations', formatNumber(data.metrics?.animationCount)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="panel metric-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Packaging</span>
                      <h2>Delivery contract</h2>
                    </div>
                  </div>
                  <div className="technical-metrics">
                    {[
                      ['Source format', data.metrics?.format ?? '—'],
                      ['Source size', formatBytes(data.sourceBytes)],
                      ['Textures', formatNumber(data.metrics?.textureCount)],
                      ['External resources', formatNumber(data.metrics?.externalResourceCount)],
                      [
                        'Vertex normals',
                        data.metrics ? (data.metrics.hasNormals ? 'Complete' : 'Missing') : '—',
                      ],
                      [
                        'Tangents',
                        data.metrics
                          ? data.metrics.hasTangents
                            ? 'Complete'
                            : 'Not supplied'
                          : '—',
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="panel bounds-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Spatial metadata</span>
                      <h2>Declared bounds</h2>
                    </div>
                  </div>
                  {data.metrics?.bounds ? (
                    <div className="bounds-visual">
                      <div className="axis axis-x">
                        <span>X</span>
                        <strong>
                          {data.metrics.bounds.min[0]} → {data.metrics.bounds.max[0]}
                        </strong>
                      </div>
                      <div className="axis axis-y">
                        <span>Y</span>
                        <strong>
                          {data.metrics.bounds.min[1]} → {data.metrics.bounds.max[1]}
                        </strong>
                      </div>
                      <div className="axis axis-z">
                        <span>Z</span>
                        <strong>
                          {data.metrics.bounds.min[2]} → {data.metrics.bounds.max[2]}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p className="quiet-copy">No accessor bounds were declared.</p>
                  )}
                </article>
              </section>
            )}
            {tab === 'versions' && (
              <section className="panel table-panel">
                <table>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Kind</th>
                      <th>Processor</th>
                      <th>Size</th>
                      <th>SHA-256</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.versions.map((version) => (
                      <tr key={version.id}>
                        <td>
                          <strong>v{version.versionNumber}</strong>
                        </td>
                        <td>
                          <StatusBadge value={version.kind} />
                        </td>
                        <td>{version.processorVersion ?? 'Original source'}</td>
                        <td>{formatBytes(version.byteSize)}</td>
                        <td>
                          <code>{version.sha256.slice(0, 12)}…</code>
                        </td>
                        <td>{formatDate(version.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {tab === 'history' && (
              <section className="timeline-panel panel">
                <div className="timeline">
                  {data.history.map((entry, index) => (
                    <div className="timeline-item" key={`${entry.changedAt}-${index}`}>
                      <span className="timeline-dot" />
                      <div>
                        <div>
                          <StatusBadge value={entry.toStatus} />
                          <time>{formatDate(entry.changedAt)}</time>
                        </div>
                        <strong>
                          {entry.fromStatus
                            ? `${humanize(entry.fromStatus)} → ${humanize(entry.toStatus)}`
                            : humanize(entry.toStatus)}
                        </strong>
                        <p>{entry.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </DataState>
    </>
  );
}
