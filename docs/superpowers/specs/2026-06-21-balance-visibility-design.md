# Balance Show/Hide

**Date:** 2026-06-21
**Status:** Approved

## Problem

User ingin bisa menyembunyikan nominal saldo di dashboard dan halaman dompet — misalnya saat layar terlihat orang lain.

## Goal

Toggle show/hide saldo: eye icon di header home. Saat hidden, semua nominal saldo (dashboard, dompet, widget) tampil sebagai `••••••`. Preferensi persisten lintas sesi.

## Scope

- Toggle di home screen header
- Hide balance di: home total, wallets header total, wallet card per-item, widget Saldo
- Persist ke AsyncStorage
- Monthly summary (pemasukan/pengeluaran) **tidak** di-hide — itu statistik, bukan saldo

**Out of scope:** PIN/biometric lock, per-wallet hide, hide income/expense stats.

---

## Architecture

### lib/ThemeProvider.tsx

Tambah ke `ThemeContext` dan `AppThemeProvider`:

```ts
type ThemeCtx = {
  colorMode: ColorMode;
  colors: AppColors;
  balanceVisible: boolean;
  toggleBalanceVisible: () => void;
};
```

- Baca initial value dari `AsyncStorage.getItem('@balance_visible')` saat mount (default `true` kalau key belum ada)
- `toggleBalanceVisible` → flip → `AsyncStorage.setItem('@balance_visible', ...)`
- Export hook baru: `useBalanceVisible(): { balanceVisible: boolean; toggleBalanceVisible: () => void }`

AsyncStorage key: `@balance_visible` (string `'true'` / `'false'`).

---

## UI Changes

### app/(app)/(tabs)/index.tsx — Home

Header (baris greeting + sign-out):
- Tambah eye icon (`Feather: eye` / `eye-off`) di antara greeting dan sign-out button
- Tap icon → `toggleBalanceVisible()`

Balance card:
```tsx
<Text style={styles.balanceValue}>
  {balanceVisible ? formatRupiah(total) : '••••••'}
</Text>
```

Monthly summary (`monthCard`) — tidak berubah, tetap tampil.

### app/(app)/(tabs)/wallets.tsx — Dompet

Header total:
```tsx
<Text style={styles.total}>
  {balanceVisible ? formatRupiah(total) : '••••••'}
</Text>
```

Per wallet card:
```tsx
<Text style={styles.cardBalance}>
  {balanceVisible ? formatRupiah(Number(item.current_balance)) : '••••••'}
</Text>
```

### lib/widget/snapshot.ts — Widget Saldo

Sebelum build snapshot, baca AsyncStorage:
```ts
const raw = await AsyncStorage.getItem('@balance_visible');
const balanceVisible = raw !== 'false';
const balanceStr = balanceVisible ? formatRupiah(total) : '••••••';
```

Widget Saldo render `balanceStr`. Widget lain (Ringkasan, Terbaru) tidak menampilkan saldo absolut — tidak perlu diubah.

---

## Files Impacted

| File | Perubahan |
|---|---|
| `lib/ThemeProvider.tsx` | Tambah `balanceVisible` state + `toggleBalanceVisible` + `useBalanceVisible` hook |
| `app/(app)/(tabs)/index.tsx` | Eye icon di header + conditional `formatRupiah` |
| `app/(app)/(tabs)/wallets.tsx` | Conditional `formatRupiah` di header + tiap card |
| `lib/widget/snapshot.ts` | Baca `@balance_visible` dari AsyncStorage sebelum build snapshot |

Tidak ada file baru.
