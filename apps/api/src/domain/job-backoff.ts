export function retryDelaySeconds(attempt: number, random = Math.random): number {
  const boundedAttempt = Math.max(1, Math.min(attempt, 10));
  const base = Math.min(2 ** boundedAttempt, 300);
  return Math.max(1, Math.round(base * (0.75 + random() * 0.5)));
}
