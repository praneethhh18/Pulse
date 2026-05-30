import type { TransactionDoc } from '../domain/types';

const DAY = 24 * 60 * 60 * 1000;

// Rolling windows (robust to any calendar date): "recent" = last 30 days,
// "previous" = the 30 days before that.
export function inWindow(iso: string, startDaysAgo: number, endDaysAgo: number): boolean {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return t <= now - endDaysAgo * DAY && t > now - startDaysAgo * DAY;
}

/** Debit totals per category within a day-window (endDaysAgo..startDaysAgo). */
export function spendByCategory(
  txns: TransactionDoc[],
  startDaysAgo: number,
  endDaysAgo = 0,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.direction !== 'debit') continue;
    if (!inWindow(t.occurredAt, startDaysAgo, endDaysAgo)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return map;
}

export function formatInr(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
