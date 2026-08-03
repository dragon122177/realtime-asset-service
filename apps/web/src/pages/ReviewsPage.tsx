import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AssetPreview } from '../components/AssetPreview';
import { DataState } from '../components/DataState';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { formatDate, formatNumber, humanize } from '../lib/format';

export function ReviewsPage() {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ['reviews', 'PENDING'],
    queryFn: () => api.reviews('PENDING'),
  });
  const [selectedId, setSelectedId] = useState('');
  const [summary, setSummary] = useState('');
  useEffect(() => {
    if (!selectedId && reviews.data?.reviews[0]) setSelectedId(reviews.data.reviews[0].id);
  }, [reviews.data, selectedId]);
  const selected = reviews.data?.reviews.find((review) => review.id === selectedId);
  const decide = useMutation({
    mutationFn: (decision: 'APPROVED' | 'CHANGES_REQUESTED') =>
      api.decideReview(selectedId, decision, summary),
    onSuccess: () => {
      setSummary('');
      setSelectedId('');
      void queryClient.invalidateQueries();
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Human in the loop"
        title="Quality review"
        description="Inspect the delivery candidate, automated findings and release evidence before publication."
      />
      <DataState
        loading={reviews.isLoading}
        error={reviews.error}
        empty={!reviews.data?.reviews.length}
        emptyTitle="The review queue is clear"
        emptyBody="Processed delivery candidates will appear here when they require a human decision."
      >
        <section className="review-layout">
          <aside className="panel review-queue">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Pending</span>
                <h2>{reviews.data?.reviews.length} decisions</h2>
              </div>
              <ClipboardCheck />
            </div>
            {reviews.data?.reviews.map((review) => (
              <button
                key={review.id}
                className={selectedId === review.id ? 'selected' : ''}
                onClick={() => {
                  setSelectedId(review.id);
                  setSummary('');
                }}
              >
                <span className="review-thumb">
                  <ShieldCheck />
                </span>
                <span>
                  <strong>{review.assetName}</strong>
                  <small>
                    {review.projectName} · {formatDate(review.createdAt)}
                  </small>
                </span>
                <b>{review.qualityScore}</b>
              </button>
            ))}
          </aside>
          {selected && (
            <div className="review-workspace">
              <AssetPreview assetId={selected.assetId} kind="delivery" />
              <article className="panel review-decision">
                <div className="review-heading">
                  <div>
                    <span className="eyebrow">{selected.projectName}</span>
                    <h2>{selected.assetName}</h2>
                    <p>{selected.sourceFilename}</p>
                  </div>
                  <div className="review-score">
                    <strong>{selected.qualityScore}</strong>
                    <span>quality score</span>
                  </div>
                </div>
                <div className="metric-row compact-metrics">
                  <div>
                    <span>Triangles</span>
                    <strong>{formatNumber(selected.metrics.estimatedTriangles)}</strong>
                  </div>
                  <div>
                    <span>Primitives</span>
                    <strong>{formatNumber(selected.metrics.primitiveCount)}</strong>
                  </div>
                  <div>
                    <span>Materials</span>
                    <strong>{formatNumber(selected.metrics.materialCount)}</strong>
                  </div>
                  <div>
                    <span>Policy</span>
                    <StatusBadge value={selected.qualityDecision} />
                  </div>
                </div>
                <div className="review-findings">
                  <h3>Automated findings</h3>
                  {selected.findings.length ? (
                    selected.findings.map((finding) => (
                      <div key={finding.code}>
                        <StatusBadge value={finding.severity} />
                        <span>
                          <strong>{humanize(finding.code)}</strong>
                          <small>{finding.message}</small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div>
                      <StatusBadge value="PASS" />
                      <span>
                        <strong>No blocking findings</strong>
                        <small>The candidate remains subject to visual approval.</small>
                      </span>
                    </div>
                  )}
                </div>
                <label>
                  Review notes
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Record the visual decision or requested change…"
                    rows={3}
                  />
                </label>
                <div className="decision-actions">
                  <button
                    className="danger-button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate('CHANGES_REQUESTED')}
                  >
                    <MessageSquareWarning size={17} /> Request changes
                  </button>
                  <button
                    className="primary-button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate('APPROVED')}
                  >
                    <CheckCircle2 size={17} /> Approve and publish
                  </button>
                </div>
                {decide.error && <div className="form-error">{decide.error.message}</div>}
              </article>
            </div>
          )}
        </section>
      </DataState>
    </>
  );
}
