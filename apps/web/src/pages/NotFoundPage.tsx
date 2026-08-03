import { Boxes } from 'lucide-react';
import { Link } from '../context/RouterContext';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="empty-orbit">
        <Boxes />
      </div>
      <span className="eyebrow">404 · route not found</span>
      <h1>This scene is outside the workspace.</h1>
      <p>Return to the delivery command center to continue.</p>
      <Link to="/" className="primary-button">
        Back to overview
      </Link>
    </div>
  );
}
