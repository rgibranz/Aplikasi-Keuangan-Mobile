-- =============================================================
--  Migrasi 0003 — Jenis dompet baru + kecualikan dari total saldo
--
--  Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--  tempel SELURUH blok begin; ... commit; -> Run.
--
--  Idempotent — aman dijalankan ulang.
--  Catatan: ALTER TYPE ... ADD VALUE aman di dalam transaksi pada
--  Postgres 12+ (Supabase = PG 15) SELAMA nilai baru tidak dipakai
--  di transaksi yang sama. Migrasi ini hanya menambah, tidak memakai.
-- =============================================================

begin;

-- 1. Jenis dompet baru
alter type wallet_enum add value if not exists 'Tabungan';
alter type wallet_enum add value if not exists 'Investasi';

-- 2. Kolom kecualikan dari total saldo
alter table public.wallets
  add column if not exists exclude_from_total boolean not null default false;

commit;
