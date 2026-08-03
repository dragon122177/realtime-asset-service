import {
  Boxes,
  ClipboardCheck,
  Gauge,
  History,
  LogOut,
  Menu,
  Orbit,
  UploadCloud,
  Workflow,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useRouter } from '../context/RouterContext';
import { useLiveUpdates } from '../hooks/useLiveUpdates';

const navigation = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/assets', label: 'Asset library', icon: Boxes },
  { to: '/upload', label: 'Ingest asset', icon: UploadCloud },
  { to: '/reviews', label: 'Quality review', icon: ClipboardCheck },
  { to: '/jobs', label: 'Processing jobs', icon: Workflow },
  { to: '/audit', label: 'Audit trail', icon: History },
];

export function Layout({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  useLiveUpdates(Boolean(user));
  const active = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu />
      </button>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Orbit />
          </div>
          <div>
            <strong>ForgeFlow</strong>
            <span>3D operations</span>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">NL</div>
          <div>
            <strong>Northstar Labs</strong>
            <span>Production workspace</span>
          </div>
          <span className="live-dot" title="Live updates connected" />
        </div>
        <nav>
          <span className="nav-label">Workspace</span>
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`nav-link ${active(to) ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
              {active(to) && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-insight">
          <div className="insight-orbit">
            <span />
          </div>
          <strong>Delivery guardrails active</strong>
          <p>Every upload is hashed, analyzed and reviewed before publication.</p>
        </div>
        <div className="user-card">
          <div className="user-avatar">
            {user?.displayName
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div>
            <strong>{user?.displayName}</strong>
            <span>{user?.role}</span>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => {
              logout();
              navigate('/login', true);
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}
      <main className="main-content">
        <div className="top-strip">
          <span>
            <span className="status-pulse" /> All control-plane services operational
          </span>
          <span className="top-role">Signed in as {user?.role.toLowerCase()}</span>
        </div>
        <div className="content-frame">{children}</div>
      </main>
    </div>
  );
}
