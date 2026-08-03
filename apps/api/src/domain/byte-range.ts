export type ByteRange = { start: number; end: number };

export function parseByteRange(header: string | undefined, size: number): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) throw new Error('invalid_range');
  const startText = match[1] ?? '';
  const endText = match[2] ?? '';
  if (!startText && !endText) throw new Error('invalid_range');

  let start: number;
  let end: number;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0) throw new Error('invalid_range');
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    throw new Error('invalid_range');
  }
  return { start, end: Math.min(end, size - 1) };
}
