import { getDb, runExclusive } from './db';
import { currentUserId, currentUserIdOrNull } from './db/user';
import { uuidv4 } from './db/uuid';
import { nowIso } from './db/time';
import { applyEffect, type TxEffect } from './db/balances';
import { syncSoon } from './sync';
import type { Transaction, TransactionType } from './types';
import { computeAdjustment } from './reconcile';
import { findOrCreateAdjustmentCategory } from './categories';
import { getWallets } from './wallets';

export type TransactionInput = {
  transaction_type: TransactionType;
  amount: number;
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string | null;
  notes: string | null;
  transaction_date: string; // ISO string
};

// transactions TIDAK punya created_at (server memakai transaction_date).
const COLS =
  'id, user_id, wallet_id, destination_wallet_id, category_id, transaction_type, amount, notes, transaction_date';

export async function getTransactions(): Promise<Transaction[]> {
  const uid = await currentUserIdOrNull();
  if (!uid) return [];
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `select ${COLS} from transactions where user_id = ? and deleted_at is null order by transaction_date desc`,
    [uid],
  );
}

export async function getTransaction(id: string): Promise<Transaction> {
  const db = await getDb();
  const row = await db.getFirstAsync<Transaction>(
    `select ${COLS} from transactions where id = ? and deleted_at is null`,
    [id],
  );
  if (!row) throw new Error('Transaksi tidak ditemukan.');
  return row;
}

// Saldo dompet diatur lokal lewat applyEffect (replika trigger server) di dalam
// satu transaksi DB, di-serialkan oleh runExclusive. Saat sync, saldo otoritatif
// diambil ulang dari server.
export async function createTransaction(input: TransactionInput): Promise<void> {
  const uid = await currentUserId();
  const db = await getDb();
  const now = nowIso();
  const id = uuidv4();
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      await db.runAsync(
        `insert into transactions
           (id, user_id, wallet_id, destination_wallet_id, category_id, transaction_type, amount, notes, transaction_date, updated_at, deleted_at, dirty, server_synced)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 1, 0)`,
        [id, uid, input.wallet_id, input.destination_wallet_id, input.category_id,
          input.transaction_type, input.amount, input.notes, input.transaction_date, now],
      );
      await applyEffect(db, input, 1);
    }),
  );
  syncSoon();
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      const old = await db.getFirstAsync<TxEffect & { deleted_at: string | null }>(
        'select transaction_type, amount, wallet_id, destination_wallet_id, deleted_at from transactions where id = ?',
        [id],
      );
      if (!old) throw new Error('Transaksi tidak ditemukan.');
      if (!old.deleted_at) await applyEffect(db, old, -1); // batalkan efek lama
      await db.runAsync(
        `update transactions set
           wallet_id = ?, destination_wallet_id = ?, category_id = ?, transaction_type = ?,
           amount = ?, notes = ?, transaction_date = ?, updated_at = ?, dirty = 1
         where id = ?`,
        [input.wallet_id, input.destination_wallet_id, input.category_id, input.transaction_type,
          input.amount, input.notes, input.transaction_date, now, id],
      );
      await applyEffect(db, input, 1); // terapkan efek baru
    }),
  );
  syncSoon();
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      const old = await db.getFirstAsync<TxEffect & { deleted_at: string | null }>(
        'select transaction_type, amount, wallet_id, destination_wallet_id, deleted_at from transactions where id = ?',
        [id],
      );
      if (!old || old.deleted_at) return;
      await applyEffect(db, old, -1);
      await db.runAsync(
        'update transactions set deleted_at = ?, updated_at = ?, dirty = 1 where id = ?',
        [now, now, id],
      );
    }),
  );
  syncSoon();
}

export type ReconcileResult =
  | { adjusted: false }
  | { adjusted: true; type: 'Income' | 'Expense'; amount: number };

// Sesuaikan saldo dompet ke nilai nyata: hitung selisih, lalu catat sebagai
// transaksi Income/Expense biasa (saldo & sync terurus oleh createTransaction).
// JANGAN sentuh current_balance langsung — itu otoritas trigger server.
export async function reconcileWallet(
  walletId: string,
  actualBalance: number,
): Promise<ReconcileResult> {
  const wallets = await getWallets();
  const wallet = wallets.find((w) => w.id === walletId);
  if (!wallet) throw new Error('Dompet tidak ditemukan.');

  const adj = computeAdjustment(actualBalance, wallet.current_balance);
  if (!adj) return { adjusted: false };

  const categoryId = await findOrCreateAdjustmentCategory(adj.type);
  await createTransaction({
    transaction_type: adj.type,
    amount: adj.amount,
    wallet_id: walletId,
    destination_wallet_id: null,
    category_id: categoryId,
    notes: 'Penyesuaian saldo',
    transaction_date: nowIso(),
  });
  return { adjusted: true, type: adj.type, amount: adj.amount };
}
