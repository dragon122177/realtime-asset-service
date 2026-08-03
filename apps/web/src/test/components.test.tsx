import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../components/StatusBadge';
import { compactId, formatBytes, formatNumber, humanize } from '../lib/format';

describe('display formatting', () => {
  it('formats asset sizes and metric numbers', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
    expect(formatBytes('invalid')).toBe('—');
    expect(formatNumber(123456)).toBe('123,456');
    expect(formatNumber(null)).toBe('—');
  });

  it('humanizes identifiers and compacts long IDs', () => {
    expect(humanize('READY_FOR_REVIEW')).toBe('Ready For Review');
    expect(compactId('1234567890123456')).toBe('12345678…');
    expect(compactId('short')).toBe('short');
  });
});

describe('StatusBadge', () => {
  it('renders a human label and semantic tone', () => {
    render(<StatusBadge value="PUBLISHED" />);
    expect(screen.getByText('Published')).toHaveClass('status-success');
  });
});
