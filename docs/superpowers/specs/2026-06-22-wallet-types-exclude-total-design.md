# Jenis Dompet Baru + Kecualikan dari Total Saldo

**Tanggal:** 2026-06-22
**Status:** Disetujui (siap implementasi)

## Masalah

Semua dompet selalu ikut dihitung ke total saldo. User butuh dompet tabungan/investasi
yang nilainya *tidak* tercampur ke total saldo harian, plus label jenis yang sesuai.

## Lingkup

Dua fitur yang digabung:

1. **Jenis dompet baru** — tambah `Tabungan` & `Investasi` ke `wallet_type`.
2. **Kecualikan dari total** — kolom `exclude_from_total` per dompet; dompet yang
   dikecualikan tetap tampil di daftar tapi tidak masuk total saldo.

Bisa diatur saat **membuat** dompet dan **mengubah** dompet yang sudah ada (opsi B).

**Di luar lingkup:** target/goal tabungan, reorder dompet, arsip, edit nama/saldo dompet
(edit hanya untuk saklar `exclude_from_total`).

## Skema Data

### SQLite (`lib/db/schema.ts`)
`user_version` saat ini = 4. Tambah blok `version < 5` di `migrate()`, ikut pola
try/catch yang ada (SQLite < 3.35 di Android lama tidak support `IF NOT EXISTS`):
```js
if (version < 5) {
  try { await db.execAsync('alter table wallets add column exclude_from_total integer not null default 0'); } catch {}
  await db.execAsync('PRAGMA user_version = 5');
}
```
Jenis dompet di SQLite hanya `text` tanpa constraint — tidak perlu migration untuk
jenis baru.

### Supabase (`supabase/migrations/0003_wallet_exclude_total.sql`)
```sql
alter type wallet_enum add value if not exists 'Tabungan';
alter type wallet_enum add value if not exists 'Investasi';
alter table public.wallets
  add column if not exists exclude_from_total boolean not null default false;
```
`ALTER TYPE ... ADD VALUE` aman di Postgres 15 (Supabase) selama nilai baru tidak
dipakai di transaksi yang sama — migration ini hanya menambah, tidak memakai.

## Tipe & Data Layer

- `lib/types.ts`: `WalletType = 'Bank' | 'E-Wallet' | 'Cash' | 'Tabungan' | 'Investasi'`.
  Tambah `exclude_from_total: boolean` ke interface `Wallet` (disimpan 0/1 di SQLite,
  dibaca jadi boolean).
- `lib/wallets.ts`:
  - `createWallet` menerima & menyimpan `exclude_from_total`.
  - `getWallets` ikut `select` kolom baru dan map ke boolean.
  - **Baru:** `updateWallet(id, { exclude_from_total })` — set kolom, `updated_at = now`,
    `dirty = 1`, lalu `syncSoon()`. Hanya untuk saklar exclude (bukan rename/saldo).

## Sync (`lib/sync/index.ts`)

Push insert & update wallet sertakan `exclude_from_total`. Pull merge kolom baru ke
SQLite. Tidak ada perlakuan khusus selain menambah field ke payload.

## Perhitungan Total Saldo (3 titik)

Filter `exclude_from_total` sebelum menjumlah:

- `app/(app)/(tabs)/index.tsx` (home) — `.filter(w => !w.exclude_from_total)` sebelum reduce.
- `app/(app)/(tabs)/wallets.tsx` (tab dompet) — sama.
- `lib/widget/snapshot.ts` (widget) — tambah `and exclude_from_total = 0` di query SQL.

Dompet yang dikecualikan **tetap dirender** di daftar dompet, diberi badge kecil
"tidak dihitung".

## UI

### Form tambah dompet (`wallets.tsx` AddWalletModal)
- `WALLET_TYPES` tambah `'Tabungan'`, `'Investasi'`.
- Saklar (Switch) "Jangan hitung ke total saldo". **Default nyala otomatis** saat jenis
  dipilih `Tabungan`/`Investasi`, tetap bisa diubah manual.

### Edit dompet yang sudah ada (opsi B)
- Tap kartu dompet di tab dompet → modal kecil berisi nama (read-only) + Switch
  "Hitung ke total saldo".
- Toggle memanggil `updateWallet(id, { exclude_from_total })` lalu refresh daftar.

## Error Handling

Mengikuti pola yang ada: try/catch + `Alert.alert('Gagal ...', message)`. Tidak ada
jalur baru yang berisiko hilang data — kolom punya default, migration idempoten
(`add column if not exists`, `add value if not exists`).

## Testing

- Cek manual: bikin dompet Tabungan → default tercentang → total saldo tidak berubah.
- Toggle dompet lama jadi dikecualikan → total berkurang; nyalakan lagi → total kembali.
- Sinkron ke device kedua → status exclude ikut.
- Self-check kecil untuk logika penjumlahan (filter exclude) di mana praktis.
