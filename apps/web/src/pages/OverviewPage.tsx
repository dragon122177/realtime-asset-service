import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, ClipboardCheck, Layers3, Sparkles, Workflow } from 'lucide-react';
import { AssetPreview } from '../components/AssetPreview';
import { DataState } from '../components/DataState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from '../context/RouterContext';
import { api } from '../lib/api';
import { formatDate, formatNumber, humanize } from '../lib/format';

export function OverviewPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    refetchInterval: 30_000,
  });
  const assets = useQuery({ queryKey: ['assets', 'overview'], queryFn: () => api.assets() });
  const spotlight =
    assets.data?.assets.find((asset) => asset.currentVersionId) ?? assets.data?.assets[0];
  const data = dashboard.data;
  return (
    <>
      <PageHeader
        eyebrow="Asset operations"
        title="Delivery command center"
        description="Monitor geometry, processing capacity and release readiness across every realtime experience."
        actions={
          <Link to="/upload" className="primary-button">
            <Sparkles size={17} /> Ingest new asset
          </Link>
        }
      />
      <DataState loading={dashboard.isLoading} error={dashboard.error} empty={!data}>
        {data && (
          <>
            <section className="stat-grid">
              <StatCard
                label="Managed assets"
                value={data.assets.total}
                detail={`${data.projects} active projects`}
                icon={Boxes}
                accent="violet"
              />
              <StatCard
                label="Published"
                value={data.assets.published}
                detail="Approved delivery versions"
                icon={Layers3}
                accent="green"
              />
              <StatCard
                label="Review queue"
                value={data.pendingReviews}
                detail="Awaiting human decision"
                icon={ClipboardCheck}
                accent="amber"
              />
              <StatCard
                label="Processing fleet"
                value={data.jobs.running + data.jobs.queued}
                detail={`${data.jobs.running} running · ${data.jobs.queued} queued`}
                icon={Workflow}
                accent="cyan"
              />
            </section>
            <section className="overview-grid">
              <article className="panel pipeline-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Current throughput</span>
                    <h2>Asset pipeline</h2>
                  </div>
                  <Link to="/jobs">
                    Inspect jobs <ArrowRight size={15} />
                  </Link>
                </div>
                <div className="pipeline-track">
                  {[
                    [
                      'Ingested',
                      (data.assets.byStatus.UPLOADED ?? 0) + (data.assets.byStatus.QUEUED ?? 0),
                      'violet',
                    ],
                    ['Processing', data.assets.byStatus.PROCESSING ?? 0, 'cyan'],
                    ['In review', data.assets.byStatus.READY_FOR_REVIEW ?? 0, 'amber'],
                    ['Published', data.assets.byStatus.PUBLISHED ?? 0, 'green'],
                  ].map(([label, count, tone], index) => (
                    <div className="pipeline-step" key={String(label)}>
                      <span className={`pipeline-node node-${tone}`}>{index + 1}</span>
                      <div>
                        <strong>{count}</strong>
                        <small>{label}</small>
                      </div>
                      {index < 3 && <i />}
                    </div>
                  ))}
                </div>
                <div className="pipeline-health">
                  <div>
                    <span className="health-ring">
                      {data.assets.total
                        ? Math.round((data.assets.published / data.assets.total) * 100)
                        : 0}
                      %
                    </span>
                    <span>
                      <strong>Release coverage</strong>
                      <small>Assets with a published version</small>
                    </span>
                  </div>
                  <div>
                    <span className="health-number">{data.assets.needsAttention}</span>
                    <span>
                      <strong>Needs attention</strong>
                      <small>Failed or changes requested</small>
                    </span>
                  </div>
                  <div>
                    <span className="health-number">{data.jobs.failed}</span>
                    <span>
                      <strong>Terminal jobs</strong>
                      <small>Manual retry may be required</small>
                    </span>
                  </div>
                </div>
              </article>
              <article className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Event stream</span>
                    <h2>Recent activity</h2>
                  </div>
                  <span className="live-label">
                    <i /> Live
                  </span>
                </div>
                <div className="activity-list">
                  {data.activity.length === 0 && (
                    <p className="quiet-copy">
                      Pipeline events will appear after the first upload.
                    </p>
                  )}
                  {data.activity.map((event) => (
                    <div className="activity-item" key={event.id}>
                      <span className="activity-icon">
                        <Workflow size={16} />
                      </span>
                      <div>
                        <strong>{humanize(event.eventType)}</strong>
                        <small>
                          {event.assetId ? `Asset ${event.assetId.slice(0, 8)}` : 'Workspace event'}
                        </small>
                      </div>
                      <time>{formatDate(event.createdAt)}</time>
                    </div>
                  ))}
                </div>
              </article>
            </section>
            {spotlight && (
              <section className="panel spotlight-panel">
                <div className="spotlight-preview">
                  <AssetPreview
                    assetId={spotlight.id}
                    kind={spotlight.currentVersionId ? 'delivery' : 'source'}
                    compact
                  />
                </div>
                <div className="spotlight-copy">
                  <div className="eyebrow">Latest asset</div>
                  <div className="spotlight-title">
                    <h2>{spotlight.name}</h2>
                    <StatusBadge value={spotlight.status} />
                  </div>
                  <p>
                    {spotlight.projectName} · {spotlight.sourceFilename}
                  </p>
                  <div className="metric-row">
                    <div>
                      <span>Quality</span>
                      <strong>
                        {spotlight.qualityScore ?? '—'}
                        {spotlight.qualityScore !== null ? '/100' : ''}
                      </strong>
                    </div>
                    <div>
                      <span>Triangles</span>
                      <strong>{formatNumber(spotlight.metrics?.estimatedTriangles)}</strong>
                    </div>
                    <div>
                      <span>Draw calls</span>
                      <strong>{formatNumber(spotlight.metrics?.primitiveCount)}</strong>
                    </div>
                    <div>
                      <span>Format</span>
                      <strong>
                        {spotlight.metrics?.format ?? spotlight.contentType.split('/').at(-1)}
                      </strong>
                    </div>
                  </div>
                  <Link className="secondary-button" to={`/assets/${spotlight.id}`}>
                    Open technical review <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            )}
          </>
        )}
      </DataState>
    </>
  );
}
