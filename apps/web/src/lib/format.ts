export function formatBytes(value: number | string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US').format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function compactId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
