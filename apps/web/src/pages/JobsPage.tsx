import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw, Workflow } from 'lucide-react';
import { DataState } from '../components/DataState';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from '../context/RouterContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export function JobsPage() {
  const queryClient = useQueryClient();
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: api.jobs, refetchInterval: 10_000 });
  const retry = useMutation({
    mutationFn: api.retryJob,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
  return (
    <>
      <PageHeader
        eyebrow="Workflow orchestration"
        title="Processing jobs"
        description="Observe leases, attempts and terminal failures across the asynchronous asset pipeline."
        actions={
          <span className="live-label">
            <i /> Refreshes every 10s
          </span>
        }
      />
      <section className="job-summary-row">
        {[
          [
            'Ready',
            jobs.data?.jobs.filter((job) => ['QUEUED', 'RETRY_WAIT'].includes(job.status)).length ??
              0,
          ],
          ['Running', jobs.data?.jobs.filter((job) => job.status === 'RUNNING').length ?? 0],
          ['Succeeded', jobs.data?.jobs.filter((job) => job.status === 'SUCCEEDED').length ?? 0],
          ['Failed', jobs.data?.jobs.filter((job) => job.status === 'FAILED').length ?? 0],
        ].map(([label, count]) => (
          <div key={label}>
            <Activity />
            <span>
              <strong>{count}</strong>
              <small>{label}</small>
            </span>
          </div>
        ))}
      </section>
      <DataState
        loading={jobs.isLoading}
        error={jobs.error}
        empty={!jobs.data?.jobs.length}
        emptyTitle="No processing jobs"
        emptyBody="The first asset upload will create a durable job."
      >
        <section className="panel table-panel jobs-table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Status</th>
                <th>Attempt</th>
                <th>Worker lease</th>
                <th>Last change</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.data?.jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link to={`/assets/${job.assetId}`}>
                      <span className="table-icon">
                        <Workflow />
                      </span>
                      <span>
                        <strong>{job.assetName}</strong>
                        <small>{job.jobType.replaceAll('_', ' ').toLowerCase()}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <StatusBadge value={job.status} />
                  </td>
                  <td>
                    {job.attempt} / {job.maxAttempts}
                  </td>
                  <td>
                    <code>{job.lockedBy ?? 'unclaimed'}</code>
                  </td>
                  <td>
                    <span>{formatDate(job.updatedAt)}</span>
                    {job.lastError && <small className="table-error">{job.lastError}</small>}
                  </td>
                  <td>
                    {job.status === 'FAILED' && (
                      <button
                        className="icon-button"
                        title="Retry failed job"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(job.id)}
                      >
                        <RefreshCw />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </DataState>
    </>
  );
}
