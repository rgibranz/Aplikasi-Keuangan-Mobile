import type { Transaction } from './types';

export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
  );
}

// Total pemasukan & pengeluaran pada bulan yang sama dengan `ref`.
// Transfer tidak dihitung (hanya perpindahan antar dompet milik sendiri).
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

// Pengeluaran dikelompokkan per kategori untuk satu bulan (dipakai di Laporan).
export function expenseByCategory(
  txs: Transaction[],
  ref: Date,
): { categoryId: string | null; total: number }[] {
  const map = new Map<string | null, number>();
  for (const t of txs) {
    if (t.transaction_type !== 'Expense') continue;
    if (!isSameMonth(t.transaction_date, ref)) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount));
  }
  return Array.from(map.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}
