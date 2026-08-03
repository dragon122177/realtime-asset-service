import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Boxes, Search, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { DataState } from '../components/DataState';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from '../context/RouterContext';
import { api } from '../lib/api';
import { formatBytes, formatDate, formatNumber } from '../lib/format';
import type { AssetStatus } from '../types';

const statuses: Array<AssetStatus | ''> = [
  '',
  'QUEUED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'PUBLISHED',
  'FAILED',
];

export function AssetsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AssetStatus | ''>('');
  const assets = useQuery({
    queryKey: ['assets', status, search],
    queryFn: () => api.assets({ status: status || undefined, search: search || undefined }),
  });
  return (
    <>
      <PageHeader
        eyebrow="Content inventory"
        title="Asset library"
        description="Trace every source, delivery candidate and release decision from one operational view."
        actions={
          <Link to="/upload" className="primary-button">
            <UploadCloud size={17} /> Upload asset
          </Link>
        }
      />
      <section className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or filename"
          />
        </label>
        <div className="filter-tabs">
          {statuses.map((value) => (
            <button
              key={value || 'all'}
              className={status === value ? 'active' : ''}
              onClick={() => setStatus(value)}
            >
              {value ? value.replaceAll('_', ' ').toLowerCase() : 'all assets'}
            </button>
          ))}
        </div>
      </section>
      <DataState
        loading={assets.isLoading}
        error={assets.error}
        empty={!assets.data?.assets.length}
        emptyTitle="No assets match this view"
        emptyBody="Adjust the filters or upload a glTF asset to start the pipeline."
      >
        <section className="asset-card-grid">
          {assets.data?.assets.map((asset, index) => (
            <Link to={`/assets/${asset.id}`} className="asset-card" key={asset.id}>
              <div className={`asset-thumbnail gradient-${(index % 4) + 1}`}>
                <div className="mini-cube">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="asset-format">
                  {asset.metrics?.format ?? (asset.contentType.endsWith('binary') ? 'GLB' : 'GLTF')}
                </span>
              </div>
              <div className="asset-card-body">
                <div className="asset-card-title">
                  <div>
                    <span>{asset.projectName}</span>
                    <h3>{asset.name}</h3>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
                <StatusBadge value={asset.status} />
                <div className="asset-card-metrics">
                  <div>
                    <span>Triangles</span>
                    <strong>{formatNumber(asset.metrics?.estimatedTriangles)}</strong>
                  </div>
                  <div>
                    <span>Primitives</span>
                    <strong>{formatNumber(asset.metrics?.primitiveCount)}</strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{formatBytes(asset.sourceBytes)}</strong>
                  </div>
                </div>
                <div className="asset-card-footer">
                  <span>{asset.tags.length ? asset.tags.join(' · ') : 'untagged'}</span>
                  <time>{formatDate(asset.updatedAt)}</time>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </DataState>
      {!assets.isLoading && assets.data?.assets.length === 0 && (
        <div className="empty-library-mark">
          <Boxes />
        </div>
      )}
    </>
  );
}
