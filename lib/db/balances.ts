import type { SQLiteCtx } from './index';
import type { TransactionType } from '../types';

// Replika trigger saldo server (handle_transaction_balance) untuk dipakai
// SAAT MENULIS LOKAL, agar saldo benar walau offline. current_balance bersifat
// "display lokal": tidak ditandai dirty & tidak di-push — saat sync, nilai
// otoritatif diambil ulang dari server (lihat lib/sync).
export interface TxEffect {
  transaction_type: TransactionType;
  amount: number;
  wallet_id: string;
  destination_wallet_id: string | null;
}

async function bump(ctx: SQLiteCtx, walletId: string, delta: number): Promise<void> {
  await ctx.runAsync(
    'update wallets set current_balance = current_balance + ? where id = ?',
    [delta, walletId],
  );
}

// sign = +1 untuk MENERAPKAN efek, -1 untuk MEMBATALKAN.
// Konvensi sama persis dengan trigger server:
//   Income   : +amount ke wallet
//   Expense  : -amount dari wallet
//   Transfer : -amount dari sumber, +amount ke tujuan
export async function applyEffect(ctx: SQLiteCtx, t: TxEffect, sign: number): Promise<void> {
  const a = t.amount * sign;
  if (t.transaction_type === 'Income') {
    await bump(ctx, t.wallet_id, a);
  } else if (t.transaction_type === 'Expense') {
    await bump(ctx, t.wallet_id, -a);
  } else if (t.transaction_type === 'Transfer') {
    await bump(ctx, t.wallet_id, -a);
    if (t.destination_wallet_id) await bump(ctx, t.destination_wallet_id, a);
  }
}
