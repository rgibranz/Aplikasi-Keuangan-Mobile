# Sesuaikan Saldo (Reconcile Wallet Balance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sesuaikan saldo" feature so a user can type the real balance of a wallet and have the app record an adjustment transaction for the difference.

**Architecture:** `current_balance` is derived (initial_balance + transaction effects, server-trigger authoritative), so reconciliation is done by creating a normal Income/Expense transaction equal to the difference. A pure `computeAdjustment` function decides direction/amount; orchestration reuses the existing `createTransaction`; the adjustment uses an auto-created "Penyesuaian Saldo" category.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript, expo-sqlite (offline-first), pnpm.

## Global Constraints

- Package manager is **pnpm** (not npm). Do not run `npm`.
- Bump `version` in `app.json` on the UI task's commit (patch bump for this feature).
- No new DB schema/migration. Do not write `current_balance` directly.
- Currency is Rupiah, integer amounts (no decimals) — round the difference.
- Reuse existing helpers: `createTransaction` (lib/transactions.ts), `createCategory`/`getCategories` (lib/categories.ts), `nowIso` (lib/db/time.ts), `currentUserId` (lib/db/user.ts), `getWallets` (lib/wallets.ts), `formatRupiah` (lib/format.ts), `useThemeColors`/`F` (lib/ThemeProvider.tsx).
- The pure logic file (`lib/reconcile.ts`) MUST NOT import any Expo/React Native/SQLite module — it stays runnable under `node --experimental-strip-types`.

---

### Task 1: Pure adjustment math

**Files:**
- Create: `lib/reconcile.ts`
- Test: `lib/reconcile.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type Adjustment = { type: 'Income' | 'Expense'; amount: number }` and `export function computeAdjustment(actualBalance: number, currentBalance: number): Adjustment | null` — returns `null` when the rounded difference is 0; otherwise `type` is `'Income'` when actual > current else `'Expense'`, and `amount` is the rounded absolute difference (always a positive integer).

- [ ] **Step 1: Write the failing test**

Create `lib/reconcile.test.ts`:

```ts
// Run: node --experimental-strip-types lib/reconcile.test.ts
// ponytail: no test runner in this repo; node strips TS types (Node >= 22.6 via fnm).
import assert from 'node:assert';
import { computeAdjustment } from './reconcile.ts';

// actual > current -> Income for the difference
assert.deepStrictEqual(computeAdjustment(250000, 200000), { type: 'Income', amount: 50000 });

// actual < current -> Expense for the absolute difference
assert.deepStrictEqual(computeAdjustment(170000, 200000), { type: 'Expense', amount: 30000 });

// equal -> no adjustment
assert.strictEqual(computeAdjustment(200000, 200000), null);

// float noise rounds away to zero -> no adjustment
assert.strictEqual(computeAdjustment(200000.4, 200000), null);

// rounds to nearest integer Rupiah
assert.deepStrictEqual(computeAdjustment(200000.6, 200000), { type: 'Income', amount: 1 });

// negative real balance is allowed
assert.deepStrictEqual(computeAdjustment(-5000, 0), { type: 'Expense', amount: 5000 });

console.log('reconcile: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types lib/reconcile.test.ts`
Expected: FAIL — cannot find module `./reconcile.ts` (or `computeAdjustment` not exported).

- [ ] **Step 3: Write minimal implementation**

Create `lib/reconcile.ts`:

```ts
// Logika murni penyesuaian saldo. SENGAJA tanpa import Expo/RN/SQLite agar bisa
// dijalankan langsung oleh node (lihat reconcile.test.ts). Orkestrasi yang
// menyentuh DB ada di lib/transactions.ts (reconcileWallet).

export type Adjustment = { type: 'Income' | 'Expense'; amount: number };

// Selisih saldo nyata vs tercatat. Dibulatkan ke Rupiah utuh (buang galat float).
// null = sudah cocok, tidak perlu transaksi.
export function computeAdjustment(
  actualBalance: number,
  currentBalance: number,
): Adjustment | null {
  const diff = Math.round(actualBalance - currentBalance);
  if (diff === 0) return null;
  return { type: diff > 0 ? 'Income' : 'Expense', amount: Math.abs(diff) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types lib/reconcile.test.ts`
Expected: PASS — prints `reconcile: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/reconcile.ts lib/reconcile.test.ts
git commit -m "feat(reconcile): pure computeAdjustment + assert check"
```

---

### Task 2: Find-or-create the "Penyesuaian Saldo" category

**Files:**
- Modify: `lib/categories.ts`

**Interfaces:**
- Consumes: existing `createCategory`, `getDb`, `currentUserId`. Categories are typed `'Income' | 'Expense'` (see `CategoryType`).
- Produces: `export async function findOrCreateAdjustmentCategory(type: 'Income' | 'Expense'): Promise<string>` — returns the `id` of a non-deleted category named exactly `'Penyesuaian Saldo'` with the matching `category_type` for the current user, creating it (icon `sliders`, color `#94A3B8`) if absent.

- [ ] **Step 1: Add the helper**

Append to `lib/categories.ts` (the file already imports `getDb`, `currentUserId`, and exports `createCategory`):

```ts
// Kategori bawaan untuk transaksi penyesuaian saldo. Dibuat sekali per tipe
// (Income & Expense terpisah karena kategori bertipe). Idempoten: cari dulu.
const ADJUSTMENT_CATEGORY_NAME = 'Penyesuaian Saldo';

export async function findOrCreateAdjustmentCategory(
  type: 'Income' | 'Expense',
): Promise<string> {
  const uid = await currentUserId();
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    `select id from categories
       where user_id = ? and category_type = ? and category_name = ? and deleted_at is null
       limit 1`,
    [uid, type, ADJUSTMENT_CATEGORY_NAME],
  );
  if (existing) return existing.id;
  const created = await createCategory({
    category_name: ADJUSTMENT_CATEGORY_NAME,
    category_type: type,
    icon_name: 'sliders',
    color_hex: '#94A3B8',
  });
  return created.id;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add lib/categories.ts
git commit -m "feat(reconcile): findOrCreateAdjustmentCategory helper"
```

---

### Task 3: `reconcileWallet` orchestration

**Files:**
- Modify: `lib/transactions.ts`

**Interfaces:**
- Consumes: `computeAdjustment` (Task 1), `findOrCreateAdjustmentCategory` (Task 2), existing `createTransaction`, `getWallets` (lib/wallets.ts), `nowIso`.
- Produces: `export type ReconcileResult = { adjusted: false } | { adjusted: true; type: 'Income' | 'Expense'; amount: number }` and `export async function reconcileWallet(walletId: string, actualBalance: number): Promise<ReconcileResult>` — looks up the wallet's `current_balance`, computes the adjustment, and (when non-null) records it as a transaction via `createTransaction` using the adjustment category; returns what happened for UI feedback.

- [ ] **Step 1: Add imports**

At the top of `lib/transactions.ts`, add to the existing import block:

```ts
import { computeAdjustment } from './reconcile';
import { findOrCreateAdjustmentCategory } from './categories';
import { getWallets } from './wallets';
```

- [ ] **Step 2: Add the function**

Append to `lib/transactions.ts`:

```ts
export type ReconcileResult =
  | { adjusted: false }
  | { adjusted: true; type: 'Income' | 'Expense'; amount: number };

// Sesuaikan saldo dompet ke nilai nyata: hitung selisih, lalu catat sebagai
// transaksi Income/Expense biasa (saldo & sync terurus oleh createTransaction).
// JANGAN sentuh current_balance langsung — itu otoritas trigger server.
export async function reconcileWallet(
  walletId: string,
  actualBalance: number,
): Promise<ReconcileResult> {
  const wallets = await getWallets();
  const wallet = wallets.find((w) => w.id === walletId);
  if (!wallet) throw new Error('Dompet tidak ditemukan.');

  const adj = computeAdjustment(actualBalance, wallet.current_balance);
  if (!adj) return { adjusted: false };

  const categoryId = await findOrCreateAdjustmentCategory(adj.type);
  await createTransaction({
    transaction_type: adj.type,
    amount: adj.amount,
    wallet_id: walletId,
    destination_wallet_id: null,
    category_id: categoryId,
    notes: 'Penyesuaian saldo',
    transaction_date: nowIso(),
  });
  return { adjusted: true, type: adj.type, amount: adj.amount };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add lib/transactions.ts
git commit -m "feat(reconcile): reconcileWallet orchestration"
```

---

### Task 4: Wallet-detail UI — button, modal, feedback

**Files:**
- Modify: `app/(app)/wallet-detail.tsx`
- Modify: `app.json` (version bump)

**Interfaces:**
- Consumes: `reconcileWallet`, `ReconcileResult` (Task 3), `formatRupiah` (already imported), `useThemeColors`/`F` (already imported). The wallet's current balance is available as the `balance` route param (string) and via `walletMap[id].current_balance`.

- [ ] **Step 1: Add imports and state**

In `app/(app)/wallet-detail.tsx`:

Add `Modal` and `TextInput` to the existing `react-native` import:

```ts
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
```

Add `reconcileWallet` to the transactions import:

```ts
import { deleteTransaction, getTransactions, reconcileWallet } from '../../lib/transactions';
```

Inside the component, after the existing `useState` hooks, add:

```ts
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileInput, setReconcileInput] = useState('');
  const [reconciling, setReconciling] = useState(false);
```

- [ ] **Step 2: Add the handler**

In the component (next to `toggleExclude`), add:

```ts
  function openReconcile() {
    const current = walletMap[id]?.current_balance ?? Number(balance ?? 0);
    setReconcileInput(String(Math.round(current)));
    setReconcileOpen(true);
  }

  async function submitReconcile() {
    const actual = Number(reconcileInput);
    if (!reconcileInput.trim() || Number.isNaN(actual)) {
      Alert.alert('Angka tidak valid', 'Masukkan saldo dompet yang sebenarnya.');
      return;
    }
    setReconciling(true);
    try {
      const res = await reconcileWallet(id, actual);
      setReconcileOpen(false);
      await load();
      if (!res.adjusted) {
        Alert.alert('Sudah cocok', 'Saldo sudah sesuai, tidak ada yang diubah.');
      } else {
        const sign = res.type === 'Income' ? '+' : '−';
        const label = res.type === 'Income' ? 'pemasukan' : 'pengeluaran';
        Alert.alert(
          'Saldo disesuaikan',
          `${sign}${formatRupiah(res.amount)} dicatat sebagai ${label}.`,
        );
      }
    } catch (e) {
      Alert.alert('Gagal menyesuaikan', e instanceof Error ? e.message : 'Error');
    } finally {
      setReconciling(false);
    }
  }
```

- [ ] **Step 3: Add the button in the hero section**

In the JSX, immediately after the closing `</View>` of `styles.toggleRow` (still inside `styles.heroSection`), add:

```tsx
        <Pressable style={styles.reconcileBtn} onPress={openReconcile}>
          <Feather name="sliders" size={16} color={colors.primary} />
          <Text style={styles.reconcileBtnText}>Sesuaikan saldo</Text>
        </Pressable>
```

- [ ] **Step 4: Add the modal**

Just before the final closing `</SafeAreaView>`, add:

```tsx
      <Modal
        visible={reconcileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReconcileOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sesuaikan saldo</Text>
            <Text style={styles.modalHint}>
              Berapa saldo {name} yang sebenarnya sekarang?
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reconcileInput}
              onChangeText={setReconcileInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setReconcileOpen(false)}
                disabled={reconciling}
              >
                <Text style={styles.modalBtnGhostText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitReconcile}
                disabled={reconciling}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {reconciling ? 'Menyimpan…' : 'Sesuaikan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
```

- [ ] **Step 5: Add styles**

In `getStyles(c)`, add these keys to the `StyleSheet.create({ ... })` object:

```ts
    reconcileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginTop: 10,
    },
    reconcileBtnText: { fontSize: 14, fontWeight: '700', color: c.primary, fontFamily: F.b },

    modalBackdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 10,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: c.text, fontFamily: F.b },
    modalHint: { fontSize: 13, color: c.muted, fontFamily: F.r },
    modalInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      color: c.text,
      fontFamily: F.b,
      marginTop: 4,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalBtnGhost: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
    modalBtnGhostText: { fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    modalBtnPrimary: { backgroundColor: c.primary },
    modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: F.b },
```

- [ ] **Step 6: Bump app version**

In `app.json`, change `"version": "0.7.2"` to `"version": "0.7.3"`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 8: Manual smoke check**

Run the app (`pnpm expo start`), open a wallet detail, tap "Sesuaikan saldo", enter a number different from the shown balance, confirm:
- an adjustment transaction appears in the wallet's history with category "Penyesuaian Saldo",
- the hero balance updates after `load()`,
- entering the exact current balance shows "Sudah cocok".

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/wallet-detail.tsx" app.json
git commit -m "feat(wallets): sesuaikan saldo (reconcile) button + modal"
```

---

## Notes for the implementer

- `colors.primary` and `c.primary` are the same value (`useThemeColors()`); the white text on the primary button matches other primary CTAs in the app.
- If `npx tsc` reports pre-existing errors unrelated to these files, ignore them — only ensure you add none.
- Guest mode needs no special handling: `createTransaction` already resolves `currentUserId`, and the sync layer gates guests out of the cloud.
