import type {
  AssetDetail,
  AssetStatus,
  AssetSummary,
  AuditEvent,
  Dashboard,
  Job,
  Project,
  Review,
  User,
} from '../types';

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const tokenKey = 'forgeflow_token';

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  const headers = new Headers(options.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? `Request failed with status ${response.status}.`,
    );
  }
  if (response.status === 204 || response.headers.get('content-length') === '0')
    return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  tokenKey,
  baseUrl,
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>('/api/v1/auth/me'),
  liveTicket: () =>
    request<{ ticket: string; expiresInSeconds: number }>('/api/v1/auth/live-ticket', {
      method: 'POST',
    }),
  dashboard: () => request<Dashboard>('/api/v1/dashboard'),
  projects: () => request<{ projects: Project[] }>('/api/v1/projects'),
  assets: (filters: { status?: AssetStatus; projectId?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (filters.status) query.set('status', filters.status);
    if (filters.projectId) query.set('projectId', filters.projectId);
    if (filters.search) query.set('search', filters.search);
    return request<{ assets: AssetSummary[] }>(`/api/v1/assets?${query}`);
  },
  asset: (id: string) => request<AssetDetail>(`/api/v1/assets/${id}`),
  upload: (input: { file: File; projectId: string; name: string; tags: string }) => {
    const form = new FormData();
    form.set('projectId', input.projectId);
    form.set('name', input.name);
    form.set('tags', input.tags);
    form.set('file', input.file);
    return request<{ asset: AssetDetail; deduplicated: boolean }>('/api/v1/assets', {
      method: 'POST',
      body: form,
    });
  },
  reprocess: (id: string) =>
    request<{ status: string }>(`/api/v1/assets/${id}/reprocess`, { method: 'POST' }),
  async downloadAsset(id: string, kind: 'source' | 'delivery'): Promise<ArrayBuffer> {
    const token = localStorage.getItem(tokenKey);
    const response = await fetch(`${baseUrl}/api/v1/assets/${id}/content?kind=${kind}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok)
      throw new ApiError(response.status, 'PREVIEW_FAILED', 'The 3D preview could not be loaded.');
    return response.arrayBuffer();
  },
  jobs: () => request<{ jobs: Job[] }>('/api/v1/jobs'),
  retryJob: (id: string) =>
    request<{ status: string }>(`/api/v1/jobs/${id}/retry`, { method: 'POST' }),
  reviews: (status: Review['status'] = 'PENDING') =>
    request<{ reviews: Review[] }>(`/api/v1/reviews?status=${status}`),
  decideReview: (id: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', summary: string) =>
    request<{ status: string }>(`/api/v1/reviews/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, summary }),
    }),
  audit: () => request<{ events: AuditEvent[] }>('/api/v1/audit'),
};

export { ApiError };
