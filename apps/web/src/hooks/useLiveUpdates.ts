import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';

export function useLiveUpdates(enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | undefined;
    let cancelled = false;
    void api
      .liveTicket()
      .then(({ ticket }) => {
        if (cancelled) return;
        source = new EventSource(`${api.baseUrl}/api/v1/live?ticket=${encodeURIComponent(ticket)}`);
        source.addEventListener('update', () => {
          void queryClient.invalidateQueries();
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [enabled, queryClient]);
}
