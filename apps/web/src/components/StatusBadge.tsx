import { humanize } from '../lib/format';

const toneByStatus: Record<string, string> = {
  PUBLISHED: 'success',
  APPROVED: 'success',
  SUCCEEDED: 'success',
  PASS: 'success',
  PROCESSING: 'info',
  RUNNING: 'info',
  READY_FOR_REVIEW: 'review',
  PENDING: 'review',
  REVIEW: 'review',
  QUEUED: 'neutral',
  RETRY_WAIT: 'warning',
  CHANGES_REQUESTED: 'warning',
  FAILED: 'danger',
  BLOCK: 'danger',
  ARCHIVED: 'muted',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status-badge status-${toneByStatus[value] ?? 'neutral'}`}>
      {humanize(value)}
    </span>
  );
}
