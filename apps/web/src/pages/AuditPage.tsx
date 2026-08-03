import { useQuery } from '@tanstack/react-query';
import { Fingerprint, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { DataState } from '../components/DataState';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import { compactId, formatDate, humanize } from '../lib/format';

export function AuditPage() {
  const [search, setSearch] = useState('');
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit });
  const events =
    audit.data?.events.filter((event) =>
      `${event.action} ${event.actorName} ${event.targetId}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Governance evidence"
        title="Audit trail"
        description="Append-only evidence for uploads, processor output, review decisions and release actions."
        actions={
          <span className="evidence-chip">
            <ShieldCheck /> Immutable at database layer
          </span>
        }
      />
      <section className="filter-bar audit-filter">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, actor or target"
          />
        </label>
        <span>{events.length} visible events</span>
      </section>
      <DataState
        loading={audit.isLoading}
        error={audit.error}
        empty={!events.length}
        emptyTitle="No matching evidence"
        emptyBody="Audit events are written as protected operations occur."
      >
        <section className="audit-list">
          {events.map((event) => (
            <article className="panel audit-event" key={event.id}>
              <span className="audit-symbol">
                <Fingerprint />
              </span>
              <div className="audit-main">
                <div>
                  <strong>{humanize(event.action)}</strong>
                  <time>{formatDate(event.occurredAt)}</time>
                </div>
                <p>
                  <b>{event.actorName}</b> changed {event.targetType}{' '}
                  <code>{compactId(event.targetId)}</code>
                </p>
                <div className="audit-context">
                  {Object.entries(event.context)
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <span key={key}>
                        {humanize(key)}: <b>{String(value)}</b>
                      </span>
                    ))}
                </div>
              </div>
              <div className="correlation">
                <span>Correlation</span>
                <code>{compactId(event.correlationId)}</code>
              </div>
            </article>
          ))}
        </section>
      </DataState>
    </>
  );
}
