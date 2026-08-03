import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = 'violet',
  footer,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  accent?: 'violet' | 'cyan' | 'green' | 'amber';
  footer?: ReactNode;
}) {
  return (
    <article className={`stat-card accent-${accent}`}>
      <div className="stat-topline">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
      {footer && <div className="stat-footer">{footer}</div>}
    </article>
  );
}
