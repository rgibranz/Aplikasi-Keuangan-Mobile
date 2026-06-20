-- =============================================================
--  AplikasiKeuangan — Skema Database Supabase
--  Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--  tempel seluruh isi file ini -> Run.
--
--  Versi ini sudah disempurnakan dari skema awal:
--   - user_id otomatis terisi (default auth.uid()) + WITH CHECK eksplisit
--   - RLS pakai (select auth.uid()) supaya lebih cepat (dievaluasi sekali)
--   - amount wajib > 0 (CHECK) supaya konvensi +/- tidak rusak
--   - Transfer DIDUKUNG penuh: ada destination_wallet_id + trigger menanganinya
-- =============================================================

-- 1. ENUMS ----------------------------------------------------
create type wallet_enum as enum ('Bank', 'E-Wallet', 'Cash');
create type transaction_enum as enum ('Income', 'Expense', 'Transfer');

-- 2. TABEL: wallets (dompet / rekening) -----------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  wallet_name varchar not null,
  wallet_type wallet_enum not null,
  current_balance numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- 3. TABEL: categories (kategori) -----------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_name varchar not null,
  category_type transaction_enum not null,
  icon_name varchar,
  color_hex varchar,
  created_at timestamptz not null default timezone('utc', now())
);

-- 4. TABEL: transactions (transaksi) --------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  destination_wallet_id uuid references public.wallets(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  transaction_type transaction_enum not null,
  amount numeric not null check (amount > 0),
  notes text,
  transaction_date timestamptz not null default timezone('utc', now()),
  -- Transfer wajib punya dompet tujuan (dan beda dari sumber).
  -- Selain Transfer, destination_wallet_id harus kosong.
  constraint transfer_destination_valid check (
    (transaction_type = 'Transfer'
      and destination_wallet_id is not null
      and destination_wallet_id <> wallet_id)
    or
    (transaction_type <> 'Transfer'
      and destination_wallet_id is null)
  )
);

-- 5. ROW LEVEL SECURITY ---------------------------------------
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "Users manage own wallets" on public.wallets
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own categories" on public.categories
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own transactions" on public.transactions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 6. INDEXES --------------------------------------------------
create index idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index idx_transactions_wallet on public.transactions(wallet_id);
create index idx_wallets_user on public.wallets(user_id);
create index idx_categories_user on public.categories(user_id);

-- 7. AUTO-UPDATE SALDO (trigger) ------------------------------
-- Saldo wallet dijaga otomatis oleh trigger ini.
-- PENTING: dari sisi aplikasi, JANGAN ikut mengubah current_balance.
-- Cukup insert/update/delete baris transaksi, lalu ambil ulang saldo wallet.
create or replace function public.handle_transaction_balance()
returns trigger
language plpgsql
as $$
begin
  -- Batalkan efek baris LAMA (berjalan saat UPDATE & DELETE).
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
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

  -- Terapkan efek baris BARU (berjalan saat INSERT & UPDATE).
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
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

  return null;
end;
$$;

create trigger on_transaction_committed
  after insert or update or delete on public.transactions
  for each row execute function public.handle_transaction_balance();
