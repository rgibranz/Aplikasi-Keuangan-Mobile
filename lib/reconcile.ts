// Logika murni penyesuaian saldo. SENGAJA tanpa import Expo/RN/SQLite agar bisa
// dijalankan langsung oleh node (lihat reconcile.test.ts). Orkestrasi yang
// menyentuh DB ada di lib/transactions.ts (reconcileWallet).

export type Adjustment = { type: 'Income' | 'Expense'; amount: number };

// Selisih saldo nyata vs tercatat. Dibulatkan ke Rupiah utuh (buang galat float).
// null = sudah cocok, tidak perlu transaksi.
export function computeAdjustment(
  actualBalance: number,
  currentBalance: number,
): Adjustment | null {
  const diff = Math.round(actualBalance - currentBalance);
  if (diff === 0) return null;
  return { type: diff > 0 ? 'Income' : 'Expense', amount: Math.abs(diff) };
}
