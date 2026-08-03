import { Box, Boxes, Check, ShieldCheck, Workflow } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';

export function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('admin@forgeflow.local');
  const [password, setPassword] = useState('ForgeFlow!2026');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <span>
            <Boxes />
          </span>{' '}
          ForgeFlow
        </div>
        <div className="login-copy">
          <div className="eyebrow">Realtime 3D delivery control plane</div>
          <h1>From source model to reviewable delivery asset.</h1>
          <p>One governed workflow for ingestion, processing, quality review and publication.</p>
          <div className="login-capabilities">
            <div>
              <Workflow />
              <span>
                <strong>Durable processing</strong>
                <small>Lease-safe jobs with retries</small>
              </span>
            </div>
            <div>
              <Box />
              <span>
                <strong>glTF intelligence</strong>
                <small>Geometry and delivery budgets</small>
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                <strong>Human approval</strong>
                <small>Evidence before publication</small>
              </span>
            </div>
          </div>
        </div>
        <div className="login-art" aria-hidden="true">
          <div className="wire-cube">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="orbit-line orbit-one">
            <b />
          </div>
          <div className="orbit-line orbit-two">
            <b />
          </div>
        </div>
        <p className="login-footnote">Synthetic workspace · No proprietary assets</p>
      </section>
      <section className="login-panel">
        <form onSubmit={(event) => void submit(event)}>
          <div className="login-form-heading">
            <span className="mini-mark">
              <Boxes />
            </span>
            <div>
              <h2>Welcome back</h2>
              <p>Sign in to the Northstar Labs workspace.</p>
            </div>
          </div>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button login-button" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Open operations console'}
          </button>
          <div className="demo-credentials">
            <Check size={16} />
            <span>
              <strong>Demo access is prefilled</strong>
              <small>All people and assets in this environment are fictional.</small>
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}
