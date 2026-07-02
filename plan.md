# Plan: Over-Engineering Cleanup

## Ringkasan
~200 baris kode bisa dihapus dari total ~2400+ baris source. Fokus di `lib/` — tidak menyentuh UI component atau screen.

---

## HIGH Priority

### 1. Hapus `lib/db/uuid.ts` — replace dg `crypto.randomUUID()`
- UUID v4 manual dengan tabel hex + bit-shifting
- `crypto.randomUUID()` sudah tersedia di Hermes sejak RN 0.73+ (bukti: `react-native-get-random-values` polyfill sudah ada)
- Semua call site import dari file ini
- **Action**: cek semua import `uuidv4`, replace dengan `import { randomUUID } from 'crypto'` (atau `import 'react-native-get-random-values'` + `crypto.randomUUID()`)
- **Hapus**: `lib/db/uuid.ts`

### 2. Hapus `lib/db/time.ts` — inline `new Date().toISOString()`
- Isi cuma `export function nowIso(): string { return new Date().toISOString(); }`
- **Action**: replace semua `import { nowIso } from './time'` jadi langsung pake `new Date().toISOString()`
- **Hapus**: `lib/db/time.ts`

### 3. Ganti `formatRupiah()` di `lib/format.ts` pakai `Intl.NumberFormat`
- Manual regex vs `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`
- **Catatan**: comment bilang "tanpa Intl supaya pasti jalan di Hermes/Android" — Hermes mendukung Intl penuh sejak RN 0.73+
- **Hapus**: ~8 baris manual formatting

---

## MEDIUM Priority

### 4. Hapus `lib/sync/useRefreshOnSync.ts`
- Isi cuma: `export function useRefreshOnSync(load: () => void): void { useEffect(() => onSynced(load), [load]); }`
- Hook satu-baris, langsung diinline aja di caller
- **Caller**: cari semua `useRefreshOnSync`
- **Hapus**: `lib/sync/useRefreshOnSync.ts`

### 5. Hapus `lib/sync/triggers.ts` — inline listener langsung
- `useSyncTriggers` wrapper ~29 baris di sekitar `syncNow` + AppState + NetInfo
- Caller (ada di `_layout.tsx` atau screen) bisa pasang listener langsung
- **Catatan**: ini decoupling yang berguna, tapi kalau caller cuma satu — yagni
- **Hapus**: `lib/sync/triggers.ts`

### 6. Hapus `__DEV__` self-check block di `recurring.ts` (baris 103-112)
- Console.warn bukan test — tidak ada assertion, silent fail di prod
- Kalau memang mau test, masukin ke `reconcile.test.ts` style atau hapus
- **Hapus**: ~10 baris

### 7. Refactor `mergeRow` di `lib/sync/index.ts` (baris 287-346)
- if/else 4 tabel, tiap branch 10+ baris SQL yang bentuknya sama
- Extract jadi table-config array + satu branch generic
- **Target**: dari ~60 baris jadi ~25 baris

---

## LOW Priority

### 8. Hapus debounce kedua `updateWidgetsSoon` (baris 151-159 di `snapshot.ts`)
- `syncSoon()` di `lib/sync/index.ts` sudah punya debounce 1200ms
- `updateWidgetsSoon()` punya debounce sendiri 1500ms
- Widget update bisa dipanggil langsung setelah `syncSoon()` tanpa timer terpisah, atau喂 `syncSoon` agar menangani keduanya
- **Hapus**: timer + debounce di `updateWidgetsSoon`

### 9. Hapus `_notifPermGranted` cache di `recurring.ts` (baris 114-120)
- Memoize manual `Notifications.requestPermissionsAsync()` sekali per session
- Expo notification system sudah handle global permission state
- **Action**: hapus `_notifPermGranted` + `hasNotifPerm()`, panggil `Notifications.requestPermissionsAsync()` langsung

### 10. Periksa `lib/theme.ts`
- File ini ada tapi belum keliatan di-import di `lib/` manapun
- Kemungkinan duplikasi warna dari `ThemeProvider.tsx`
- **Action**: grep seluruh project untuk `import.*theme` dan `from.*theme`

### 11. Shrink `lib/widget/render.tsx` — pakai warna dari ThemeProvider
- `LIGHT`/`DARK` palette di-hardcode, дубликат dari `lightColors`/`darkColors` di `ThemeProvider.tsx`
- Self-contained untuk bundle headless (comment bilang begitu), tapi bisa diimport dari ThemeProvider
- **Catatan**: mungkin tidak bisa di-import di headless context, skip kalau memang perlu tetap separate

### 12. Shrink `emptySnapshot()` di `lib/widget/snapshot.ts` (baris 33-43)
- `formatRupiah(0)` dipanggil 4 kali
- **Action**: compute sekali `const z = formatRupiah(0)` lalu reuse

---

## Checklist Perubahan

- [ ] `lib/db/uuid.ts` dihapus, semua import redirect ke `crypto.randomUUID()`
- [ ] `lib/db/time.ts` dihapus, semua call site diinline
- [ ] `lib/format.ts` `formatRupiah` ganti pakai `Intl.NumberFormat`
- [ ] `lib/sync/useRefreshOnSync.ts` dihapus, caller diinline
- [ ] `lib/sync/triggers.ts` dihapus, listener dipindah ke caller
- [ ] `recurring.ts` `__DEV__` block dihapus
- [ ] `lib/sync/index.ts` `mergeRow` di-refactor jadi generic
- [ ] `lib/widget/snapshot.ts` debounce kedua dihapus
- [ ] `recurring.ts` notification permission cache dihapus
- [ ] `lib/theme.ts` diperiksa — dihapus atau dipindahkan kalau dead
- [ ] `lib/widget/render.tsx` warna di-share dari ThemeProvider (kalau memungkinkan)
- [ ] `lib/widget/snapshot.ts` `emptySnapshot` di-shrink

---

## Catatan
- Tidak ada perubahan di `app/` (screen) atau `components/` — murni lib/ refactor
- Setiap perubahan wajib test manual: guest mode, login mode, offline mode, sync
- Guideline ponytail: kalau ragu, tidak ubah — konsentrasi di hal yang jelas-jelas redundan
