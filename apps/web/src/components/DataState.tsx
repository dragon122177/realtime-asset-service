import { AlertTriangle, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function DataState({
  loading,
  error,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'New records will appear here when they are available.',
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="data-state">
        <LoaderCircle className="spin" />
        <strong>Loading workspace</strong>
        <span>Reading the latest pipeline state.</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="data-state state-error">
        <AlertTriangle />
        <strong>Could not load this view</strong>
        <span>{error instanceof Error ? error.message : 'Try again in a moment.'}</span>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="data-state">
        <div className="empty-orbit" />
        <strong>{emptyTitle}</strong>
        <span>{emptyBody}</span>
      </div>
    );
  }
  return children;
}
