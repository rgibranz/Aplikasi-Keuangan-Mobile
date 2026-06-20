import type { Transaction } from './types';

export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
  );
}

export function monthlyTotals(
  txs: Transaction[],
  ref: Date,
): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!isSameMonth(t.transaction_date, ref)) continue;
    if (t.transaction_type === 'Income') income += Number(t.amount);
    else if (t.transaction_type === 'Expense') expense += Number(t.amount);
  }
  return { income, expense };
}

export function totalsByCategory(
  txs: Transaction[],
  ref: Date,
  type: 'Income' | 'Expense',
): { categoryId: string | null; total: number }[] {
  const map = new Map<string | null, number>();
  for (const t of txs) {
    if (t.transaction_type !== type) continue;
    if (!isSameMonth(t.transaction_date, ref)) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount));
  }
  return Array.from(map.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}

// ── New multi-period functions ──────────────────────────────────────────────

export type BarPoint = { label: string; income: number; expense: number };

function dateToYMD(d: Date): number {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

function isInRange(iso: string, from: Date, to: Date): boolean {
  const ymd = dateToYMD(new Date(iso));
  return ymd >= dateToYMD(from) && ymd <= dateToYMD(to);
}

export function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function periodTotals(
  txs: Transaction[],
  from: Date,
  to: Date,
): { income: number; expense: number } {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (!isInRange(t.transaction_date, from, to)) continue;
    if (t.transaction_type === 'Income') income += Number(t.amount);
    else if (t.transaction_type === 'Expense') expense += Number(t.amount);
  }
  return { income, expense };
}

export function totalsByCategoryRange(
  txs: Transaction[],
  from: Date,
  to: Date,
  type: 'Income' | 'Expense',
): { categoryId: string | null; total: number }[] {
  const map = new Map<string | null, number>();
  for (const t of txs) {
    if (t.transaction_type !== type) continue;
    if (!isInRange(t.transaction_date, from, to)) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount));
  }
  return Array.from(map.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}

export function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dailyTotals(txs: Transaction[], date: Date): { income: number; expense: number } {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (!isSameDay(t.transaction_date, date)) continue;
    if (t.transaction_type === 'Income') income += Number(t.amount);
    else if (t.transaction_type === 'Expense') expense += Number(t.amount);
  }
  return { income, expense };
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function weekChartData(txs: Transaction[], ws: Date): BarPoint[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const { income, expense } = dailyTotals(txs, d);
    return { label: DAY_LABELS[i], income, expense };
  });
}

export function monthChartData(txs: Transaction[], ref: Date): BarPoint[] {
  const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const points: BarPoint[] = [];
  const cursor = new Date(firstDay);
  let wNum = 1;
  while (cursor <= lastDay) {
    const wEnd = new Date(cursor);
    wEnd.setDate(wEnd.getDate() + 6);
    if (wEnd > lastDay) wEnd.setTime(lastDay.getTime());
    const { income, expense } = periodTotals(txs, new Date(cursor), wEnd);
    points.push({ label: `M${wNum}`, income, expense });
    cursor.setDate(cursor.getDate() + 7);
    wNum++;
  }
  return points;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export function yearChartData(txs: Transaction[], year: number): BarPoint[] {
  return MONTH_LABELS.map((label, i) => {
    const { income, expense } = monthlyTotals(txs, new Date(year, i, 1));
    return { label, income, expense };
  });
}
