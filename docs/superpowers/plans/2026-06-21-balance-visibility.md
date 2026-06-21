# Balance Show/Hide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah toggle show/hide saldo — eye icon di header home, state global persisted di AsyncStorage, berlaku di home, wallets, dan widget Saldo.

**Architecture:** `balanceVisible` boolean ditambahkan ke `ThemeContext` yang sudah ada (pola UI preference global yang sama dengan dark/light). Screens membaca via `useBalanceVisible()` hook baru. Widget snapshot baca AsyncStorage key `@balance_visible` langsung sebelum build.

**Tech Stack:** React Native, AsyncStorage (`@react-native-async-storage/async-storage` — sudah terpasang), Expo SDK 56, Expo Router, Feather icons.

## Global Constraints

- Expo SDK 56 (`~56.x.x`) — jangan upgrade dependency
- AsyncStorage key: `@balance_visible` (string `'true'` / `'false'`, default `true` bila key belum ada)
- Teks tersembunyi: `'••••••'` (enam bullet Unicode U+2022)
- Monthly summary (pemasukan/pengeluaran di home) TIDAK ikut di-hide — hanya `current_balance` dan total saldo
- Widget: hanya `totalSaldoText` di widget Saldo yang berubah — widget Ringkasan & Terbaru tidak menyimpan saldo absolut, tidak perlu diubah

---

### Task 1: Extend ThemeProvider dengan balanceVisible

**Files:**
- Modify: `lib/ThemeProvider.tsx`

**Interfaces:**
- Produces:
  - `useBalanceVisible(): { balanceVisible: boolean; toggleBalanceVisible: () => void }`
  - `ThemeContext` kini punya `balanceVisible` dan `toggleBalanceVisible`

- [ ] **Step 1: Tambah import AsyncStorage dan useState/useEffect ke ThemeProvider**

Ganti seluruh isi `lib/ThemeProvider.tsx` dengan:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { TamaguiProvider } from '@tamagui/core';
import config from '../tamagui.config';

export type ColorMode = 'light' | 'dark';

export const lightColors = {
  primary:     '#C2410C',
  primaryDark: '#9A3412',
  background:  '#FAF7F2',
  card:        '#FFFFFF',
  surface:     '#F5EFE6',
  text:        '#1C1917',
  muted:       '#78716C',
  border:      '#E7DDD0',
  danger:      '#DC2626',
  income:      '#15803D',
};

export const darkColors = {
  primary:     '#E05A1F',
  primaryDark: '#C2410C',
  background:  '#141210',
  card:        '#1E1A17',
  surface:     '#2A2420',
  text:        '#F5F0EB',
  muted:       '#9C8F86',
  border:      '#3D332C',
  danger:      '#F87171',
  income:      '#22C55E',
};

export const F = {
  r:  'IBMPlexMono_400Regular',
  m:  'IBMPlexMono_500Medium',
  sb: 'IBMPlexMono_600SemiBold',
  b:  'IBMPlexMono_700Bold',
};

export type AppColors = typeof lightColors;

type ThemeCtx = {
  colorMode: ColorMode;
  colors: AppColors;
  balanceVisible: boolean;
  toggleBalanceVisible: () => void;
};

const ThemeContext = createContext<ThemeCtx>({
  colorMode: 'light',
  colors: lightColors,
  balanceVisible: true,
  toggleBalanceVisible: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme();
  const colorMode: ColorMode = sys === 'dark' ? 'dark' : 'light';
  const colors = colorMode === 'dark' ? darkColors : lightColors;
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('@balance_visible').then((val) => {
      if (val === 'false') setBalanceVisible(false);
    });
  }, []);

  function toggleBalanceVisible() {
    setBalanceVisible((prev) => {
      const next = !prev;
      void AsyncStorage.setItem('@balance_visible', String(next));
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ colorMode, colors, balanceVisible, toggleBalanceVisible }}>
      <TamaguiProvider config={config} defaultTheme={colorMode}>
        {children}
      </TamaguiProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeColors(): AppColors {
  return useContext(ThemeContext).colors;
}

export function useColorMode(): ColorMode {
  return useContext(ThemeContext).colorMode;
}

export function useBalanceVisible(): { balanceVisible: boolean; toggleBalanceVisible: () => void } {
  const { balanceVisible, toggleBalanceVisible } = useContext(ThemeContext);
  return { balanceVisible, toggleBalanceVisible };
}
```

- [ ] **Step 2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add lib/ThemeProvider.tsx
git commit -m "feat(ui): add balanceVisible to ThemeContext with AsyncStorage persistence"
```

---

### Task 2: Home screen — eye icon + conditional balance

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useBalanceVisible()` dari `lib/ThemeProvider`

- [ ] **Step 1: Tambah import useBalanceVisible**

Di baris import ThemeProvider (baris 20 saat ini), tambah `useBalanceVisible`:

```tsx
import { useThemeColors, type AppColors, F, useBalanceVisible } from '../../../lib/ThemeProvider';
```

- [ ] **Step 2: Pakai hook di dalam komponen**

Setelah `const colors = useThemeColors();` (baris 29), tambah:

```tsx
const { balanceVisible, toggleBalanceVisible } = useBalanceVisible();
```

- [ ] **Step 3: Ganti tombol signOut di header menjadi dua icon (eye + signOut)**

Ganti block `<Pressable onPress={signOut} style={styles.signOut}>` di header dengan:

```tsx
<View style={styles.headerActions}>
  <Pressable onPress={toggleBalanceVisible} style={styles.iconBtn}>
    <Feather name={balanceVisible ? 'eye' : 'eye-off'} size={16} color={colors.muted} />
  </Pressable>
  <Pressable onPress={signOut} style={styles.iconBtn}>
    <Feather name="log-out" size={16} color={colors.muted} />
  </Pressable>
</View>
```

- [ ] **Step 4: Kondisikan balanceValue di balance card**

Ganti:
```tsx
<Text style={styles.balanceValue}>{formatRupiah(total)}</Text>
```
Dengan:
```tsx
<Text style={styles.balanceValue}>
  {balanceVisible ? formatRupiah(total) : '••••••'}
</Text>
```

- [ ] **Step 5: Ganti style signOut → headerActions + iconBtn di getStyles**

Di fungsi `getStyles`, ganti:
```tsx
signOut: {
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: c.card,
  borderWidth: 1,
  borderColor: c.border,
  alignItems: 'center',
  justifyContent: 'center',
},
```
Dengan:
```tsx
headerActions: { flexDirection: 'row', gap: 8 },
iconBtn: {
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: c.card,
  borderWidth: 1,
  borderColor: c.border,
  alignItems: 'center',
  justifyContent: 'center',
},
```

- [ ] **Step 6: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/(tabs)/index.tsx
git commit -m "feat(home): eye icon toggle + hide total balance"
```

---

### Task 3: Wallets screen — conditional balance

**Files:**
- Modify: `app/(app)/(tabs)/wallets.tsx`

**Interfaces:**
- Consumes: `useBalanceVisible()` dari `lib/ThemeProvider`

- [ ] **Step 1: Tambah import useBalanceVisible**

Di baris import ThemeProvider (baris 20 saat ini):

```tsx
import { useThemeColors, type AppColors, F, useBalanceVisible } from '../../../lib/ThemeProvider';
```

- [ ] **Step 2: Pakai hook di WalletsScreen**

Setelah `const styles = getStyles(colors);`, tambah:

```tsx
const { balanceVisible } = useBalanceVisible();
```

- [ ] **Step 3: Kondisikan header total**

Ganti (baris 93 saat ini):
```tsx
<Text style={styles.total}>{formatRupiah(total)}</Text>
```
Dengan:
```tsx
<Text style={styles.total}>
  {balanceVisible ? formatRupiah(total) : '••••••'}
</Text>
```

- [ ] **Step 4: Kondisikan balance per kartu wallet**

Ganti (baris 140–142 saat ini):
```tsx
<Text style={styles.cardBalance}>
  {formatRupiah(Number(item.current_balance))}
</Text>
```
Dengan:
```tsx
<Text style={styles.cardBalance}>
  {balanceVisible ? formatRupiah(Number(item.current_balance)) : '••••••'}
</Text>
```

- [ ] **Step 5: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/(tabs)/wallets.tsx
git commit -m "feat(wallets): hide balance when balanceVisible is false"
```

---

### Task 4: Widget snapshot — ikut sembunyikan saldo

**Files:**
- Modify: `lib/widget/snapshot.ts`

**Interfaces:**
- Consumes: AsyncStorage key `@balance_visible` (string `'false'` = hidden, lainnya = visible)

- [ ] **Step 1: Baca @balance_visible di buildSnapshot sebelum format total**

Di fungsi `buildSnapshot()`, setelah baris `const total = wallets.reduce(...)` (sekitar baris 57), tambah:

```ts
const balanceRaw = await AsyncStorage.getItem('@balance_visible');
const balanceVisible = balanceRaw !== 'false';
```

- [ ] **Step 2: Kondisikan totalSaldoText di return**

Ganti (sekitar baris 99):
```ts
totalSaldoText: formatRupiah(total),
```
Dengan:
```ts
totalSaldoText: balanceVisible ? formatRupiah(total) : '••••••',
```

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 4: Bump version di app.json**

Buka `app.json`, naikkan `version` dari nilai saat ini ke patch berikutnya (misal `0.4.0` → `0.4.1`).

- [ ] **Step 5: Commit**

```bash
git add lib/widget/snapshot.ts app.json
git commit -m "feat(widget): respect balanceVisible in Saldo widget snapshot"
```

---

## Cara Test Manual

1. Buka app → home screen → tap icon eye di header kanan atas
2. Saldo total di balance card berubah jadi `••••••`
3. Buka tab Dompet → header total dan semua saldo kartu juga `••••••`
4. Tap eye lagi → semua balik ke angka normal
5. Tutup app paksa (swipe up dari recent) → buka lagi → state tersimpan
6. (Opsional, kalau ada widget Saldo terpasang) Update widget → saldo `••••••`
