-- =============================================================
--  Migrasi 0001 — Offline-first + Multi-device Sync
--  Untuk app "Uang Kita".
--
--  Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--  tempel SELURUH blok "begin; ... commit;" di bawah -> Run.
--  (Query verifikasi di paling bawah dijalankan TERPISAH bila perlu.)
--
--  JAMINAN AMAN UNTUK DATA YANG SUDAH ADA:
--   - Hanya MENAMBAH kolom & fungsi; tidak ada DROP TABLE / DELETE / UPDATE
--     terhadap baris yang sudah ada.
--   - TIDAK ADA statement yang menulis `current_balance`, jadi saldo lama
--     dijamin tidak berubah. (ALTER TABLE ADD COLUMN = DDL, tidak memicu
--     trigger saldo.)
--   - Idempotent: aman dijalankan ulang (pakai IF NOT EXISTS / OR REPLACE /
--     DROP TRIGGER IF EXISTS).
--   - Atomik: dibungkus begin/commit — kalau ada error, TIDAK ADA yang
--     ter-apply.
--
--  Yang ditambahkan:
--   1. Kolom `updated_at`  -> dasar pull incremental + last-write-wins.
--   2. Kolom `deleted_at`  -> soft-delete / tombstone, agar penghapusan
--                             ikut tersinkron ke device lain.
--   3. Trigger auto-stamp `updated_at` (server-authoritative, anti clock-skew).
--   4. Upgrade trigger saldo agar sadar soft-delete (reverse saat dihapus,
--      apply lagi saat di-restore) — tetap identik utk baris aktif lama.
--   5. Index `updated_at` untuk pull cepat.
--   6. (Opsional) RPC `soft_delete_wallet` = hapus dompet + transaksinya
--      secara atomik (pengganti ON DELETE CASCADE untuk model soft-delete).
-- =============================================================

begin;

-- 1. KOLOM updated_at ------------------------------------------
-- Baris lama otomatis terisi waktu migrasi (default now()).
alter table public.wallets      add column if not exists updated_at timestamptz not null default now();
alter table public.categories   add column if not exists updated_at timestamptz not null default now();
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

-- 2. KOLOM deleted_at (soft-delete) ---------------------------
-- NULL = aktif. Baris lama tetap NULL (tidak terhapus).
alter table public.wallets      add column if not exists deleted_at timestamptz;
alter table public.categories   add column if not exists deleted_at timestamptz;
alter table public.transactions add column if not exists deleted_at timestamptz;

-- 3. AUTO-STAMP updated_at ------------------------------------
-- Server selalu menstempel updated_at = now() pada setiap INSERT & UPDATE,
-- mengabaikan nilai kiriman device. Ini membuat urutan konflik (LWW)
-- ditentukan oleh waktu SERVER, bukan jam HP yang bisa miring.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
  before insert or update on public.wallets
  for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
  before insert or update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before insert or update on public.transactions
  for each row execute function public.set_updated_at();

-- 4. TRIGGER SALDO yang SADAR SOFT-DELETE ---------------------
-- Aturan: sebuah transaksi memengaruhi saldo HANYA jika deleted_at IS NULL.
--   - INSERT  : apply efek BARU (jika aktif).
--   - UPDATE  : reverse efek LAMA (jika dulu aktif) + apply efek BARU (jika kini aktif).
--               -> edit     = reverse lama + apply baru
--               -> hapus    = reverse lama saja (new.deleted_at terisi)
--               -> restore  = apply baru saja (old.deleted_at terisi)
--   - DELETE  : reverse efek LAMA (jika dulu aktif) — untuk hard-delete sesekali.
-- Catatan: untuk SEMUA baris lama (deleted_at = NULL), logika ini identik
-- dengan trigger versi awal, jadi saldo berjalan tetap konsisten.
create or replace function public.handle_transaction_balance()
returns trigger
language plpgsql
as $$
begin
  -- Batalkan efek baris LAMA (UPDATE & DELETE) — hanya jika dulu aktif.
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
    if (old.deleted_at is null) then
      if (old.transaction_type = 'Income') then
        update public.wallets set current_balance = current_balance - old.amount
          where id = old.wallet_id;
      elsif (old.transaction_type = 'Expense') then
        update public.wallets set current_balance = current_balance + old.amount
          where id = old.wallet_id;
      elsif (old.transaction_type = 'Transfer') then
        update public.wallets set current_balance = current_balance + old.amount
          where id = old.wallet_id;
        update public.wallets set current_balance = current_balance - old.amount
          where id = old.destination_wallet_id;
      end if;
    end if;
  end if;

  -- Terapkan efek baris BARU (INSERT & UPDATE) — hanya jika kini aktif.
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if (new.deleted_at is null) then
      if (new.transaction_type = 'Income') then
        update public.wallets set current_balance = current_balance + new.amount
          where id = new.wallet_id;
      elsif (new.transaction_type = 'Expense') then
        update public.wallets set current_balance = current_balance - new.amount
          where id = new.wallet_id;
      elsif (new.transaction_type = 'Transfer') then
        update public.wallets set current_balance = current_balance - new.amount
          where id = new.wallet_id;
        update public.wallets set current_balance = current_balance + new.amount
          where id = new.destination_wallet_id;
      end if;
    end if;
  end if;

  return null;
end;
$$;

-- Pastikan trigger terpasang (binding sama seperti semula). Idempotent.
drop trigger if exists on_transaction_committed on public.transactions;
create trigger on_transaction_committed
  after insert or update or delete on public.transactions
  for each row execute function public.handle_transaction_balance();

-- 5. INDEX untuk pull incremental -----------------------------
create index if not exists idx_wallets_updated      on public.wallets(user_id, updated_at);
create index if not exists idx_categories_updated   on public.categories(user_id, updated_at);
create index if not exists idx_transactions_updated on public.transactions(user_id, updated_at);

-- 6. (Opsional) RPC hapus dompet secara cascade (soft) --------
-- Pengganti ON DELETE CASCADE untuk model soft-delete: tandai dompet +
-- semua transaksi yang memakainya (sebagai sumber ATAU tujuan) sebagai
-- terhapus, dalam satu transaksi. RLS tetap berlaku (security invoker),
-- jadi user hanya bisa menghapus dompet miliknya sendiri.
-- Pemakaian dari app:  supabase.rpc('soft_delete_wallet', { p_wallet_id })
create or replace function public.soft_delete_wallet(p_wallet_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.transactions
     set deleted_at = now()
   where (wallet_id = p_wallet_id or destination_wallet_id = p_wallet_id)
     and deleted_at is null;

  update public.wallets
     set deleted_at = now()
   where id = p_wallet_id
     and deleted_at is null;
end;
$$;

grant execute on function public.soft_delete_wallet(uuid) to authenticated;

commit;

-- =============================================================
--  VERIFIKASI (read-only) — jalankan TERPISAH bila ingin cek.
--  Tidak mengubah apa pun.
-- =============================================================

-- a) Pastikan 6 kolom baru sudah ada:
-- select table_name, column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('wallets','categories','transactions')
--   and column_name in ('updated_at','deleted_at')
-- order by table_name, column_name;

-- b) Pastikan TIDAK ADA yang tak sengaja ke-soft-delete (semua harus 0):
-- select
--   (select count(*) from public.wallets      where deleted_at is not null) as wallets_deleted,
--   (select count(*) from public.categories   where deleted_at is not null) as categories_deleted,
--   (select count(*) from public.transactions where deleted_at is not null) as transactions_deleted;

-- c) Total saldo per user — bandingkan dgn sebelum migrasi (harus SAMA):
-- select user_id, sum(current_balance) as total_balance
-- from public.wallets
-- group by user_id;
