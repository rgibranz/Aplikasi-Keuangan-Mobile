# Sesuaikan Saldo (Reconcile Wallet Balance) — Design

Tanggal: 2026-06-28

## Masalah

User mencatat semua pemasukan & pengeluaran, tapi saldo tercatat di app sering
tidak sama dengan uang nyata di dompet/bank (ada transaksi terlewat dicatat,
pembulatan, biaya admin, dll). Belum ada cara mengoreksi tanpa menambah/menghapus
transaksi manual secara tebak-tebakan.

## Constraint arsitektur

`current_balance` adalah nilai **turunan**: `initial_balance` + akumulasi efek
semua transaksi, dijaga trigger server saat sync. Tidak boleh di-edit langsung
(akan ditimpa server). Maka koreksi harus berupa **transaksi penyesuaian** agar
saldo lokal (`applyEffect`), sync, dan trigger server tetap konsisten dan riwayat
tetap balance.

## Alur inti

1. Di layar **wallet-detail**, tombol baru **"Sesuaikan saldo"** di area hero
   (di bawah toggle "Hitung ke total saldo").
2. Tap → modal kecil: "Berapa saldo `<nama dompet>` sebenarnya sekarang?",
   TextInput numerik, default terisi saldo tercatat saat ini.
3. App hitung `selisih = saldo_asli − saldo_tercatat`:
   - selisih **> 0** → transaksi **Income** sebesar selisih
   - selisih **< 0** → transaksi **Expense** sebesar |selisih|
   - selisih **= 0** → tidak membuat transaksi; feedback "Saldo sudah cocok ✓"
4. Transaksi memakai kategori **"Penyesuaian Saldo"** (tipe Income/Expense sesuai
   arah), `notes = "Penyesuaian saldo"`, `transaction_date = sekarang`.

## Lapisan data

Fungsi baru `reconcileWallet(walletId, actualBalance)` (di `lib/transactions.ts`):

1. Ambil `current_balance` dompet (dari `getWallets()` / query langsung).
2. `diff = actualBalance − current_balance`. Bulatkan untuk hindari galat float
   (mis. `Math.round(diff)` — app pakai Rupiah, tanpa desimal). Jika `diff === 0`
   → return penanda "sudah cocok" tanpa membuat transaksi.
3. `type = diff > 0 ? 'Income' : 'Expense'`, `amount = Math.abs(diff)`.
4. `categoryId = await findOrCreateAdjustmentCategory(type)`.
5. Panggil `createTransaction({ transaction_type: type, amount, wallet_id: walletId,
   destination_wallet_id: null, category_id: categoryId, notes: 'Penyesuaian saldo',
   transaction_date: nowIso() })`.
6. Kembalikan info hasil (`{ adjusted: boolean, type, amount }`) untuk feedback UI.

Tidak ada schema/migration baru. Tidak menyentuh `current_balance` langsung.
Reuse `createTransaction` yang sudah menangani `applyEffect`, `dirty`, dan
`syncSoon`.

## Kategori "Penyesuaian Saldo"

Helper `findOrCreateAdjustmentCategory(type: 'Income' | 'Expense')`:

- Cari kategori `deleted_at is null` dengan `category_name = 'Penyesuaian Saldo'`
  dan `category_type = type` milik user saat ini.
- Jika ada → pakai `id`-nya. Jika belum → `createCategory({ category_name:
  'Penyesuaian Saldo', category_type: type, icon_name: 'sliders', color_hex:
  '#94A3B8' })`.
- Karena kategori bertipe, bisa terbentuk dua kategori bernama sama (satu Income,
  satu Expense). Itu disengaja dan benar.

## UI

- `Alert.prompt` hanya jalan di iOS; app ini Android-first. Gunakan **modal**
  (`Modal` RN atau overlay sederhana) di dalam `wallet-detail.tsx`:
  TextInput numerik + tombol "Sesuaikan" dan "Batal". Ikut style komponen yang
  sudah ada (card, warna dari `useThemeColors`).
- Setelah sukses: tutup modal, `load()` ulang, beri feedback singkat via `Alert`:
  - "Saldo disesuaikan: +Rp 50.000 dicatat sebagai pemasukan." / "−Rp 30.000
    dicatat sebagai pengeluaran." (format pakai `formatRupiah`).
  - atau "Saldo sudah cocok, tidak ada yang diubah." bila `diff === 0`.
- Input divalidasi: kosong/bukan angka → tombol nonaktif atau Alert error.

## Edge cases

- Input sama dengan saldo sekarang → no-op, feedback "sudah cocok".
- Input negatif (saldo nyata minus) → diperbolehkan; arah selisih tetap dihitung
  normal.
- Mode tamu & login → sama saja; `createTransaction` sudah pakai `currentUserId`
  dan `syncSoon` (tamu di-gate di layer sync).

## Out of scope (YAGNI)

- Tidak ada layar riwayat penyesuaian terpisah — transaksi penyesuaian sudah
  tampil di riwayat dompet.
- Tidak ada pengaturan kategori kustom untuk penyesuaian.
- Tidak ada kolom/tabel/migration DB baru.

## Perkiraan perubahan

- `lib/transactions.ts`: fungsi `reconcileWallet` + helper kategori (helper bisa
  di `lib/categories.ts`).
- `app/(app)/wallet-detail.tsx`: tombol + modal + handler.
- ~80 baris total.
