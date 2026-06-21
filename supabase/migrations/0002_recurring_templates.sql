-- =============================================================
--  Migrasi 0002 — Recurring Templates
--
--  Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--  tempel SELURUH blok begin; ... commit; -> Run.
--
--  Catatan: tabel ini LOCAL-ONLY di app (tidak di-sync ke Supabase).
--  Tabel ini dibuat di Supabase untuk cadangan / referensi saja.
--  Idempotent — aman dijalankan ulang.
-- =============================================================

begin;

create table if not exists public.recurring_templates (
  id                    text        primary key not null,
  user_id               uuid        not null references auth.users(id) on delete cascade,
  label                 text        not null,
  wallet_id             text        not null,
  destination_wallet_id text,
  category_id           text        not null,
  transaction_type      text        not null check(transaction_type in ('Income','Expense','Transfer')),
  amount                numeric     not null default 0,
  notes                 text,
  recurrence            text        not null check(recurrence in ('daily','weekly','monthly','yearly')),
  day_of_month          integer,
  time_hour             integer     not null default 8,
  time_minute           integer     not null default 0,
  next_due_at           timestamptz not null,
  notification_id       text,
  is_active             boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

-- Auto-stamp updated_at (reuse fungsi set_updated_at dari migrasi 0001)
drop trigger if exists set_recurring_templates_updated_at on public.recurring_templates;
create trigger set_recurring_templates_updated_at
  before insert or update on public.recurring_templates
  for each row execute function public.set_updated_at();

-- Index
create index if not exists idx_recurring_user on public.recurring_templates(user_id);
create index if not exists idx_recurring_next_due on public.recurring_templates(user_id, next_due_at)
  where deleted_at is null and is_active = true;

-- RLS
alter table public.recurring_templates enable row level security;

create policy "Users can manage their own recurring templates"
  on public.recurring_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
