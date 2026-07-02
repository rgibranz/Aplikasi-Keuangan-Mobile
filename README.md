# Uang Kita

Aplikasi keuangan pribadi berbasis mobile (Android) untuk mencatat pemasukan, pengeluaran, dan transfer antar dompet.

## Fitur

- **Multi-wallet** — Bank, E-Wallet, Cash, Tabungan, Investasi. Masing-masing bisa dikecualikan dari total saldo.
- **Transaksi** — Income, Expense, Transfer. Dengan kategori, catatan, dan tanggal.
- **Recurring transactions** — Template transaksi rutin (harian/mingguan/bulanan/tahunan) dengan local notification pengingat.
- **Laporan bulanan** — Ringkasan pemasukan vs pengeluaran per bulan.
- **Reconcile saldo** — Sesuaikan saldo tercatat dengan saldo nyata via transaksi penyesuaian.
- **Guest mode** — Bisa dipakai tanpa login, data tersimpan lokal.
- **Android widgets** — Saldo, Catat Cepat, Ringkasan Bulanan, Transaksi Terbaru di home screen.
- **Offline-first sync** — Semua operasi offline-first, sinkronisasi ke Supabase saat online.

## Tech Stack

- **Expo SDK 56** + React Native 0.85
- **Tamagui** — UI components
- **expo-router** — File-based routing
- **expo-sqlite** — Local database (offline-first)
- **Supabase** — Auth + cloud database
- **expo-notifications** — Local notifications untuk recurring
- **react-native-android-widget** — Android home screen widgets

## Arsitektur

### Offline-First Data Layer

```
Local SQLite (expo-sqlite)
    └── sync ──→ Supabase (PUSH dirty rows → PULL server changes)
```

Setiap tabel lokal punya kolom `dirty` dan `server_synced`. Mutasi lokal langsung写入 SQLite, ditandai `dirty=1`, lalu di-push ke Supabase saat sync. Pull menggunakan cursor-based incremental sync dengan Last-Write-Wins merge.

### Database Schema (SQLite)

| Tabel | Keterangan |
|---|---|
| `wallets` | Dompet dengan `initial_balance`, `current_balance`, `exclude_from_total` |
| `categories` | Kategori transaksi (Income/Expense) dengan icon & warna |
| `transactions` | Transaksi dengan foreign key ke wallet & category |
| `recurring_templates` | Template recurring (tidak di-sync ke cloud) |
| `sync_meta` | Cursor untuk pull incremental |

Migration version: **5** (PRAGMA user_version)

### Sync Flow

```
Mutasi lokal → dirty=1 → syncSoon(debounce 1.2s) → syncNow()
                                                      │
                                          ┌───────────▼───────────┐
                                          │  PUSH (dirty → server) │
                                          └───────────┬───────────┘
                                                      │ dirty=0
                                          ┌───────────▼───────────┐
                                          │  PULL (server → local)│
                                          └───────────────────────┘
```

Sync hanya untuk user yang login. Guest mode tidak pernah menyentuh cloud.

## Struktur Kode

```
lib/
  auth.tsx          — Supabase auth session
  ThemeProvider    — Dark/light theme + balance visibility
  wallets.ts       — Wallet CRUD
  transactions.ts  — Transaction CRUD + reconcile
  categories.ts    — Category CRUD
  recurring.ts     — Recurring template + notification scheduling
  stats.ts         — monthlyTotals helper
  format.ts        — formatRupiah, monthYearLabel
  reconcile.ts     — reconcileWallet (adjustment transaction)
  db/
    schema.ts      — SQLite schema + migrations v1–v5
    index.ts       — getDb, runExclusive, SQLiteCtx
    user.ts        — currentUserId / currentUserIdOrNull
    uuid.ts        — uuidv4
    time.ts        — nowIso, parseDate
    balances.ts    — applyEffect (update wallet balance)
  sync/
    index.ts       — syncNow, syncSoon, pushAll, pullAll
    bus.ts         — Event bus untuk onSynced / emitSynced
    triggers.ts    — Foreground sync trigger
    useRefreshOnSync.ts — Hook untuk auto-refresh UI
  supabase.ts      — Supabase client
  guest.ts         — Guest mode UUID generation

app/
  (auth)/           — Sign in / Sign up
  (app)/
    (tabs)/         — Home, Transactions, Wallets, Reports, Profile
    wallet-detail   — Detail dompet + reconcile
    transaction-form — Create / edit transaksi
    categories      — Kelola kategori
    recurring       — Daftar template recurring
    recurring-form   — Form template recurring
    changelog        — Riwayat perubahan
  _layout.tsx       — Root layout + notification listener

components/
  TransactionItem   — Row transaksi di list
  OfflineBanner     — Banner saat offline

lib/widget/
  snapshot.ts        — Generate widget data (total, recent tx, monthly summary)
  render.tsx         — Widget React tree renderer
  handler.tsx        — Widget event handler (tap → deep link)
```

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env — isi SUPABASE_URL dan SUPABASE_ANON_KEY

pnpm start        # development
pnpm android      # build Android
```

## Supabase Schema (server-side)

Trigger yang perlu disetup di Supabase:

1. **Balance trigger** — Setiap insert/update/delete transaksi, update `current_balance` dompet terkait:
   - `Income` / `Expense` → sesuaikan `current_balance` di wallet
   - `Transfer` → debit source wallet, credit destination wallet

2. **RLS (Row Level Security)** — Policy: user hanya bisa lihat/edit data miliknya (`user_id = auth.uid()`).

## Android Widgets

| Widget | Deskripsi | Update |
|---|---|---|
| Saldo | Total saldo semua dompet (exclude_from_total=false) | 30 menit |
| CatatCepat | Tombol buka transaction-form | on-demand |
| Ringkasan | Pemasukan & pengeluaran bulan ini | 30 menit |
| Terbaru | 5 transaksi terakhir | 30 menit |
