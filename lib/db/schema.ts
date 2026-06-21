import type { SQLiteDatabase } from 'expo-sqlite';

// Skema lokal = cermin tabel Supabase + kolom kontrol sinkronisasi:
//   updated_at    : untuk pull incremental + last-write-wins
//   deleted_at    : soft-delete / tombstone (agar hapus ikut tersinkron)
//   dirty         : 1 = ada perubahan lokal yang belum ter-push
//   server_synced : 1 = baris ini sudah pernah ada di server (insert vs update)
//   initial_balance (khusus wallets) : saldo awal saat dibuat; itulah yang
//     dikirim ke server saat insert pertama — delta dari transaksi diurus oleh
//     trigger server, JANGAN push current_balance.
// Catatan: wallets & categories punya created_at (server pun punya), tapi
// transactions TIDAK (server memakai transaction_date) — lihat SCHEMA_V2.
const SCHEMA_V1 = `
create table if not exists wallets (
  id text primary key,
  user_id text not null,
  wallet_name text not null,
  wallet_type text not null,
  current_balance real not null default 0,
  initial_balance real not null default 0,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  dirty integer not null default 0,
  server_synced integer not null default 0
);
create table if not exists categories (
  id text primary key,
  user_id text not null,
  category_name text not null,
  category_type text not null,
  icon_name text,
  color_hex text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  dirty integer not null default 0,
  server_synced integer not null default 0
);
create table if not exists transactions (
  id text primary key,
  user_id text not null,
  wallet_id text not null,
  destination_wallet_id text,
  category_id text,
  transaction_type text not null,
  amount real not null,
  notes text,
  transaction_date text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  dirty integer not null default 0,
  server_synced integer not null default 0
);
create table if not exists sync_meta (
  table_name text primary key,
  last_pulled_at text
);
create index if not exists idx_tx_user_date on transactions(user_id, transaction_date desc);
create index if not exists idx_tx_wallet on transactions(wallet_id);
create index if not exists idx_wallets_user on wallets(user_id);
create index if not exists idx_categories_user on categories(user_id);
`;

// v2: koreksi — tabel transactions TIDAK punya created_at (server pakai
// transaction_date). Buat ulang tabelnya (kosong/akan ditarik ulang dari
// server) lalu reset cursor transaksi agar di-pull penuh.
const SCHEMA_V2 = `
drop table if exists transactions;
create table transactions (
  id text primary key,
  user_id text not null,
  wallet_id text not null,
  destination_wallet_id text,
  category_id text,
  transaction_type text not null,
  amount real not null,
  notes text,
  transaction_date text not null,
  updated_at text not null,
  deleted_at text,
  dirty integer not null default 0,
  server_synced integer not null default 0
);
create index if not exists idx_tx_user_date on transactions(user_id, transaction_date desc);
create index if not exists idx_tx_wallet on transactions(wallet_id);
delete from sync_meta where table_name = 'transactions';
`;

const SCHEMA_V3 = `
create table if not exists recurring_templates (
  id text primary key not null,
  user_id text not null,
  label text not null,
  wallet_id text not null,
  destination_wallet_id text,
  category_id text not null,
  transaction_type text not null check(transaction_type in ('Income','Expense','Transfer')),
  amount real not null default 0,
  notes text,
  recurrence text not null check(recurrence in ('daily','weekly','monthly','yearly')),
  day_of_month integer,
  time_hour integer not null default 8,
  time_minute integer not null default 0,
  next_due_at text not null,
  notification_id text,
  is_active integer not null default 1,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);
create index if not exists idx_recurring_user on recurring_templates(user_id);
`;

// Migrasi berbasis PRAGMA user_version (pola resmi expo-sqlite SDK 56).
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(SCHEMA_V1);
    await db.execAsync('PRAGMA user_version = 1');
  }
  if (version < 2) {
    await db.execAsync(SCHEMA_V2);
    await db.execAsync('PRAGMA user_version = 2');
  }
  if (version < 3) {
    await db.execAsync(SCHEMA_V3);
    await db.execAsync('PRAGMA user_version = 3');
  }
}
