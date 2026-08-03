import { LoaderCircle } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { useRouter } from './context/RouterContext';
import { LoginPage } from './pages/LoginPage';

const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then(({ OverviewPage }) => ({ default: OverviewPage })),
);
const AssetsPage = lazy(() =>
  import('./pages/AssetsPage').then(({ AssetsPage }) => ({ default: AssetsPage })),
);
const AssetDetailPage = lazy(() =>
  import('./pages/AssetDetailPage').then(({ AssetDetailPage }) => ({ default: AssetDetailPage })),
);
const UploadPage = lazy(() =>
  import('./pages/UploadPage').then(({ UploadPage }) => ({ default: UploadPage })),
);
const ReviewsPage = lazy(() =>
  import('./pages/ReviewsPage').then(({ ReviewsPage }) => ({ default: ReviewsPage })),
);
const JobsPage = lazy(() =>
  import('./pages/JobsPage').then(({ JobsPage }) => ({ default: JobsPage })),
);
const AuditPage = lazy(() =>
  import('./pages/AuditPage').then(({ AuditPage }) => ({ default: AuditPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then(({ NotFoundPage }) => ({ default: NotFoundPage })),
);

function PageFallback() {
  return (
    <div className="page-loading" role="status">
      <LoaderCircle className="spin" />
      <span>Loading workspace…</span>
    </div>
  );
}

export function App() {
  const { user, loading } = useAuth();
  const { path, navigate } = useRouter();
  useEffect(() => {
    if (!loading && !user && path !== '/login') navigate('/login', true);
    if (!loading && user && path === '/login') navigate('/', true);
  }, [loading, navigate, path, user]);

  if (loading)
    return (
      <div className="boot-screen">
        <div className="brand-mark">
          <LoaderCircle className="spin" />
        </div>
        <strong>Opening ForgeFlow</strong>
      </div>
    );
  if (!user) return <LoginPage />;

  let page;
  const assetMatch = /^\/assets\/([0-9a-f-]{36})$/i.exec(path);
  if (path === '/') page = <OverviewPage />;
  else if (path === '/assets') page = <AssetsPage />;
  else if (assetMatch?.[1]) page = <AssetDetailPage id={assetMatch[1]} />;
  else if (path === '/upload') page = <UploadPage />;
  else if (path === '/reviews') page = <ReviewsPage />;
  else if (path === '/jobs') page = <JobsPage />;
  else if (path === '/audit') page = <AuditPage />;
  else page = <NotFoundPage />;
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>{page}</Suspense>
    </Layout>
  );
}
