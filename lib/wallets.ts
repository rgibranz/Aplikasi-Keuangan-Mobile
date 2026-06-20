import { getDb, runExclusive } from './db';
import { currentUserId, currentUserIdOrNull } from './db/user';
import { uuidv4 } from './db/uuid';
import { nowIso } from './db/time';
import { applyEffect } from './db/balances';
import { syncSoon } from './sync';
import type { TransactionType, Wallet, WalletType } from './types';

// Offline-first: semua baca/tulis lewat SQLite lokal. Mutasi memicu sync ke
// Supabase di latar belakang (lihat lib/sync). Tanda tangan fungsi sengaja
// dijaga SAMA seperti versi Supabase agar layar tidak perlu diubah.

const COLS = 'id, user_id, wallet_name, wallet_type, current_balance, created_at';

export async function getWallets(): Promise<Wallet[]> {
  const uid = await currentUserIdOrNull();
  if (!uid) return [];
  const db = await getDb();
  return db.getAllAsync<Wallet>(
    `select ${COLS} from wallets where user_id = ? and deleted_at is null order by created_at asc`,
    [uid],
  );
}

export async function createWallet(input: {
  wallet_name: string;
  wallet_type: WalletType;
  current_balance: number;
}): Promise<Wallet> {
  const uid = await currentUserId();
  const db = await getDb();
  const now = nowIso();
  const id = uuidv4();
  await runExclusive(() =>
    db.runAsync(
      `insert into wallets
         (id, user_id, wallet_name, wallet_type, current_balance, initial_balance, created_at, updated_at, deleted_at, dirty, server_synced)
       values (?, ?, ?, ?, ?, ?, ?, ?, null, 1, 0)`,
      [id, uid, input.wallet_name, input.wallet_type, input.current_balance, input.current_balance, now, now],
    ),
  );
  syncSoon();
  return {
    id,
    user_id: uid,
    wallet_name: input.wallet_name,
    wallet_type: input.wallet_type,
    current_balance: input.current_balance,
    created_at: now,
  };
}

// Hapus dompet = cascade SOFT-delete: batalkan efek saldo & tandai-hapus semua
// transaksi yang memakai dompet ini (sumber ATAU tujuan), lalu dompetnya.
// Pengganti ON DELETE CASCADE server untuk model offline/soft-delete.
export async function deleteWallet(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      const txs = await db.getAllAsync<{
        id: string;
        transaction_type: TransactionType;
        amount: number;
        wallet_id: string;
        destination_wallet_id: string | null;
      }>(
        `select id, transaction_type, amount, wallet_id, destination_wallet_id
           from transactions
          where (wallet_id = ? or destination_wallet_id = ?) and deleted_at is null`,
        [id, id],
      );
      for (const t of txs) {
        await applyEffect(db, t, -1);
        await db.runAsync(
          'update transactions set deleted_at = ?, updated_at = ?, dirty = 1 where id = ?',
          [now, now, t.id],
        );
      }
      await db.runAsync(
        'update wallets set deleted_at = ?, updated_at = ?, dirty = 1 where id = ?',
        [now, now, id],
      );
    }),
  );
  syncSoon();
}
