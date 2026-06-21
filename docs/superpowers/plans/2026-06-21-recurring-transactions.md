# Recurring Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Template transaksi rutin dengan jadwal (harian/mingguan/bulanan/tahunan) yang mengirim local notification saat jatuh tempo; tap notif → buka transaction-form pre-filled; setelah save → notif berikutnya di-schedule otomatis.

**Architecture:** Tabel SQLite `recurring_templates` (migration V3) menyimpan template dan `next_due_at`. `lib/recurring.ts` menangani CRUD + scheduling via `expo-notifications`. Root `_layout.tsx` mendengarkan notification tap dan navigasi ke form. `transaction-form.tsx` menerima prefill params dan memanggil reschedule setelah save. AppState `active` handler memperbaiki template stale (dismissed notifications).

**Tech Stack:** Expo SDK 56, expo-notifications (~56.x), expo-sqlite, expo-router, @react-native-community/datetimepicker (sudah terpasang), Feather icons.

## Global Constraints

- Expo SDK 56 — install `expo-notifications` via `npx expo install`, jangan hardcode versi
- `uuidv4()` dari `lib/db/uuid.ts` — jangan pakai library lain
- `nowIso()` dari `lib/db/time.ts` — jangan pakai `new Date().toISOString()` langsung
- `currentUserId()` dari `lib/db/user.ts` — throws jika tidak login; untuk fungsi yang boleh gagal diam-diam pakai `currentUserIdOrNull()`
- Tidak ada sync ke Supabase untuk tabel `recurring_templates`
- `amount = 0` berarti variable — form wajib diisi oleh user
- Transfer wajib punya `destination_wallet_id`; Income/Expense wajib punya `category_id`
- Notifikasi hanya di-schedule kalau `is_active = 1`
- `weekly` menggunakan rolling 7 hari dari `next_due_at` terakhir (bukan hari-spesifik dalam minggu)
- `monthly` memakai `day_of_month` dari tanggal mulai; kalau bulan tidak punya hari tersebut (misal tgl 31 di Feb) → hari terakhir bulan itu

---

### Task 1: Install expo-notifications + konfigurasi Android

**Files:**
- Modify: `app.json` (tambah plugin expo-notifications)
- Modify: `app/_layout.tsx` (set notification handler + notification channel Android)

**Interfaces:**
- Produces: `Notifications` module tersedia di seluruh project

- [ ] **Step 1: Install expo-notifications**

```bash
npx expo install expo-notifications
```

Expected output: package terpasang tanpa peer-dep error. Kalau ada peer-dep issue, tambah `--legacy-peer-deps`.

- [ ] **Step 2: Tambah plugin expo-notifications ke app.json**

Di `app.json`, di dalam `expo.plugins` array (yang sudah ada isinya), tambah entry berikut:

```json
[
  "expo-notifications",
  {
    "icon": "./assets/icon.png",
    "color": "#C2410C",
    "sounds": []
  }
]
```

- [ ] **Step 3: Setup notification handler di app/_layout.tsx**

Di bagian atas `app/_layout.tsx`, setelah semua import yang ada, tambah:

```tsx
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

Catatan: **jangan** tambah setup channel di Task ini. Channel setup dan notification listener semuanya dikerjakan di Task 7 saat kita replace seluruh `useEffect` di `AppLayout`. Memisahkannya di sini hanya akan menimbulkan konflik edit.

- [ ] **Step 5: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error baru.

- [ ] **Step 6: Commit**

```bash
git add app.json app/_layout.tsx
git commit -m "feat(recurring): install expo-notifications + Android channel setup"
```

---

### Task 2: Database migration V3 — tabel recurring_templates

**Files:**
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Produces: tabel `recurring_templates` di SQLite lokal setelah app dibuka

- [ ] **Step 1: Tambah SCHEMA_V3 di schema.ts**

Di `lib/db/schema.ts`, setelah konstanta `SCHEMA_V2` (sebelum fungsi `migrate`), tambah:

```ts
const SCHEMA_V3 = `
create table if not exists recurring_templates (
  id text primary key not null,
  user_id text not null,
  label text not null,
  wallet_id text not null,
  destination_wallet_id text,
  category_id text not null,
  transaction_type text not null check(transaction_type in ('Income','Expense','Transfer')),
  amount real not null default 0,
  notes text,
  recurrence text not null check(recurrence in ('daily','weekly','monthly','yearly')),
  day_of_month integer,
  time_hour integer not null default 8,
  time_minute integer not null default 0,
  next_due_at text not null,
  notification_id text,
  is_active integer not null default 1,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);
create index if not exists idx_recurring_user on recurring_templates(user_id);
`;
```

- [ ] **Step 2: Tambah blok migrasi V3 di fungsi migrate**

Di fungsi `migrate`, setelah blok `if (version < 2)`, tambah:

```ts
if (version < 3) {
  await db.execAsync(SCHEMA_V3);
  await db.execAsync('PRAGMA user_version = 3');
}
```

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(recurring): SQLite migration V3 — recurring_templates table"
```

---

### Task 3: lib/recurring.ts — CRUD + notification scheduling

**Files:**
- Create: `lib/recurring.ts`

**Interfaces:**
- Produces:
  - `type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'`
  - `type RecurringTemplate` (mirror kolom DB)
  - `type SaveRecurringTemplateInput`
  - `computeNextDueAt(recurrence, from, timeHour, timeMinute, dayOfMonth): Date`
  - `computeFirstDueAt(recurrence, startDate, timeHour, timeMinute, dayOfMonth): Date`
  - `getRecurringTemplates(): Promise<RecurringTemplate[]>`
  - `getRecurringTemplate(id): Promise<RecurringTemplate>`
  - `saveRecurringTemplate(input): Promise<void>`
  - `deleteRecurringTemplate(id): Promise<void>`
  - `toggleTemplateActive(id, isActive): Promise<void>`
  - `rescheduleAfterConfirm(templateId): Promise<void>`
  - `rescheduleStaleTemplates(): Promise<void>`

- [ ] **Step 1: Buat lib/recurring.ts**

```ts
import * as Notifications from 'expo-notifications';
import { getDb } from './db';
import { currentUserId, currentUserIdOrNull } from './db/user';
import { uuidv4 } from './db/uuid';
import { nowIso } from './db/time';

export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringTemplate = {
  id: string;
  user_id: string;
  label: string;
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string;
  transaction_type: 'Income' | 'Expense' | 'Transfer';
  amount: number;
  notes: string | null;
  recurrence: Recurrence;
  day_of_month: number | null;
  time_hour: number;
  time_minute: number;
  next_due_at: string;
  notification_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SaveRecurringTemplateInput = {
  id?: string;
  label: string;
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string;
  transaction_type: 'Income' | 'Expense' | 'Transfer';
  amount: number;
  notes: string | null;
  recurrence: Recurrence;
  day_of_month: number | null;
  time_hour: number;
  time_minute: number;
  start_date: Date;
  is_active: boolean;
};

// Hitung due date berikutnya dari tanggal `from`.
export function computeNextDueAt(
  recurrence: Recurrence,
  from: Date,
  timeHour: number,
  timeMinute: number,
  dayOfMonth: number | null,
): Date {
  const d = new Date(from);
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly': {
      d.setMonth(d.getMonth() + 1);
      if (dayOfMonth) {
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;
    }
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  d.setHours(timeHour, timeMinute, 0, 0);
  return d;
}

// Hitung due date pertama dari tanggal mulai (start_date).
// Kalau hasilnya sudah lewat, advance satu periode.
export function computeFirstDueAt(
  recurrence: Recurrence,
  startDate: Date,
  timeHour: number,
  timeMinute: number,
  dayOfMonth: number | null,
): Date {
  const d = new Date(startDate);
  if (recurrence === 'monthly' && dayOfMonth) {
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dayOfMonth, maxDay));
  }
  d.setHours(timeHour, timeMinute, 0, 0);
  if (d <= new Date()) {
    return computeNextDueAt(recurrence, d, timeHour, timeMinute, dayOfMonth);
  }
  return d;
}

// ponytail: self-check untuk computeNextDueAt — run sekali di __DEV__
if (__DEV__) {
  const base = new Date('2026-01-31T00:00:00.000Z');
  base.setHours(8, 0, 0, 0);
  const result = computeNextDueAt('monthly', base, 8, 0, 31);
  // Feb 2026 punya 28 hari, jadi tgl 31 → 28
  if (result.getDate() !== 28 || result.getMonth() !== 1) {
    console.warn('[recurring] computeNextDueAt monthly end-of-month FAIL', result.toISOString());
  }
}

async function scheduleNotif(
  t: Pick<RecurringTemplate, 'id' | 'label' | 'transaction_type' | 'amount' | 'wallet_id' | 'category_id' | 'destination_wallet_id' | 'notes' | 'next_due_at'>,
): Promise<string> {
  const amountText =
    t.amount > 0
      ? `Rp ${Math.round(t.amount).toLocaleString('id-ID')}`
      : 'Ketuk untuk isi nominal';
  const typeLabel =
    t.transaction_type === 'Income' ? 'Pemasukan'
    : t.transaction_type === 'Expense' ? 'Pengeluaran'
    : 'Transfer';

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return '';

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Waktunya catat: ${t.label}`,
      body: `${amountText} — ${typeLabel}`,
      data: {
        templateId: t.id,
        walletId: t.wallet_id,
        categoryId: t.category_id,
        destinationWalletId: t.destination_wallet_id ?? null,
        transactionType: t.transaction_type,
        amount: t.amount,
        notes: t.notes ?? null,
      },
      android: { channelId: 'recurring' },
    },
    trigger: { date: new Date(t.next_due_at) },
  });
}

async function cancelNotif(notifId: string | null): Promise<void> {
  if (!notifId) return;
  await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
}

export async function getRecurringTemplates(): Promise<RecurringTemplate[]> {
  const uid = await currentUserId();
  const db = await getDb();
  return db.getAllAsync<RecurringTemplate>(
    'select * from recurring_templates where user_id = ? and deleted_at is null order by created_at desc',
    [uid],
  );
}

export async function getRecurringTemplate(id: string): Promise<RecurringTemplate> {
  const db = await getDb();
  const t = await db.getFirstAsync<RecurringTemplate>(
    'select * from recurring_templates where id = ?',
    [id],
  );
  if (!t) throw new Error('Template tidak ditemukan');
  return t;
}

export async function saveRecurringTemplate(input: SaveRecurringTemplateInput): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const nextDueAt = computeFirstDueAt(
    input.recurrence, input.start_date, input.time_hour, input.time_minute, input.day_of_month,
  );

  if (input.id) {
    const existing = await getRecurringTemplate(input.id);
    await cancelNotif(existing.notification_id);
    let notifId: string | null = null;
    if (input.is_active) {
      notifId = await scheduleNotif({ ...existing, ...input, id: input.id, next_due_at: nextDueAt.toISOString() });
    }
    await db.runAsync(
      `update recurring_templates set label=?,wallet_id=?,destination_wallet_id=?,category_id=?,
       transaction_type=?,amount=?,notes=?,recurrence=?,day_of_month=?,time_hour=?,time_minute=?,
       next_due_at=?,notification_id=?,is_active=?,updated_at=? where id=?`,
      [input.label, input.wallet_id, input.destination_wallet_id, input.category_id,
       input.transaction_type, input.amount, input.notes, input.recurrence, input.day_of_month,
       input.time_hour, input.time_minute, nextDueAt.toISOString(), notifId, input.is_active ? 1 : 0, ts, input.id],
    );
  } else {
    const uid = await currentUserId();
    const id = uuidv4();
    let notifId: string | null = null;
    if (input.is_active) {
      notifId = await scheduleNotif({
        id, label: input.label, wallet_id: input.wallet_id,
        destination_wallet_id: input.destination_wallet_id,
        category_id: input.category_id, transaction_type: input.transaction_type,
        amount: input.amount, notes: input.notes, next_due_at: nextDueAt.toISOString(),
      });
    }
    await db.runAsync(
      `insert into recurring_templates
       (id,user_id,label,wallet_id,destination_wallet_id,category_id,transaction_type,
        amount,notes,recurrence,day_of_month,time_hour,time_minute,
        next_due_at,notification_id,is_active,created_at,updated_at)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, uid, input.label, input.wallet_id, input.destination_wallet_id, input.category_id,
       input.transaction_type, input.amount, input.notes, input.recurrence, input.day_of_month,
       input.time_hour, input.time_minute, nextDueAt.toISOString(), notifId, input.is_active ? 1 : 0, ts, ts],
    );
  }
}

export async function deleteRecurringTemplate(id: string): Promise<void> {
  const t = await getRecurringTemplate(id);
  await cancelNotif(t.notification_id);
  const db = await getDb();
  const ts = nowIso();
  await db.runAsync(
    'update recurring_templates set deleted_at=?,updated_at=? where id=?',
    [ts, ts, id],
  );
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  const t = await getRecurringTemplate(id);
  const db = await getDb();
  const ts = nowIso();
  if (!isActive) {
    await cancelNotif(t.notification_id);
    await db.runAsync(
      'update recurring_templates set is_active=0,notification_id=null,updated_at=? where id=?',
      [ts, id],
    );
  } else {
    const nextDueAt = computeFirstDueAt(t.recurrence, new Date(), t.time_hour, t.time_minute, t.day_of_month);
    const notifId = await scheduleNotif({ ...t, next_due_at: nextDueAt.toISOString() });
    await db.runAsync(
      'update recurring_templates set is_active=1,next_due_at=?,notification_id=?,updated_at=? where id=?',
      [nextDueAt.toISOString(), notifId, ts, id],
    );
  }
}

export async function rescheduleAfterConfirm(templateId: string): Promise<void> {
  const t = await getRecurringTemplate(templateId);
  if (!t.is_active) return;
  const nextDueAt = computeNextDueAt(t.recurrence, new Date(), t.time_hour, t.time_minute, t.day_of_month);
  const notifId = await scheduleNotif({ ...t, next_due_at: nextDueAt.toISOString() });
  const db = await getDb();
  const ts = nowIso();
  await db.runAsync(
    'update recurring_templates set next_due_at=?,notification_id=?,updated_at=? where id=?',
    [nextDueAt.toISOString(), notifId, ts, t.id],
  );
}

// Dipanggil saat app kembali foreground. Kalau user dismiss notif tanpa tap,
// next_due_at tidak pernah di-advance — fungsi ini memperbaikinya.
export async function rescheduleStaleTemplates(): Promise<void> {
  const uid = await currentUserIdOrNull();
  if (!uid) return;
  const db = await getDb();
  const now = new Date().toISOString();
  const stale = await db.getAllAsync<RecurringTemplate>(
    'select * from recurring_templates where user_id=? and is_active=1 and deleted_at is null and next_due_at < ?',
    [uid, now],
  );
  for (const t of stale) {
    let nextDueAt = new Date(t.next_due_at);
    const limit = new Date();
    while (nextDueAt <= limit) {
      nextDueAt = computeNextDueAt(t.recurrence, nextDueAt, t.time_hour, t.time_minute, t.day_of_month);
    }
    const notifId = await scheduleNotif({ ...t, next_due_at: nextDueAt.toISOString() });
    const ts = nowIso();
    await db.runAsync(
      'update recurring_templates set next_due_at=?,notification_id=?,updated_at=? where id=?',
      [nextDueAt.toISOString(), notifId, ts, t.id],
    );
  }
}
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add lib/recurring.ts
git commit -m "feat(recurring): core CRUD + notification scheduling logic"
```

---

### Task 4: recurring.tsx — List screen

**Files:**
- Create: `app/(app)/recurring.tsx`

**Interfaces:**
- Consumes: `getRecurringTemplates()`, `toggleTemplateActive()`, `type RecurringTemplate`, `formatRupiah()`
- Produces: layar daftar template yang dapat di-navigate dari profile

- [ ] **Step 1: Buat app/(app)/recurring.tsx**

```tsx
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getRecurringTemplates, toggleTemplateActive, type RecurringTemplate,
} from '../../lib/recurring';
import { formatRupiah } from '../../lib/format';
import { useThemeColors, type AppColors, F } from '../../lib/ThemeProvider';

const RECURRENCE_LABEL: Record<string, string> = {
  daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan',
};

export default function RecurringScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTemplates(await getRecurringTemplates());
    } catch {
      // abaikan
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleToggle(t: RecurringTemplate, value: boolean) {
    await toggleTemplateActive(t.id, value);
    void load();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Transaksi Rutin</Text>
        <Pressable onPress={() => router.push('/recurring-form')} hitSlop={8}>
          <Feather name="plus" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="repeat" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>Belum ada transaksi rutin</Text>
              <Text style={styles.emptyText}>
                Tap tombol + untuk menambah pengingat transaksi rutin.
              </Text>
            </View>
          }
          renderItem={({ item: t }) => (
            <Pressable
              style={[styles.card, !t.is_active && styles.cardInactive]}
              onPress={() =>
                router.push({ pathname: '/recurring-form', params: { id: t.id } })
              }
            >
              <View style={styles.cardMain}>
                <Text style={styles.cardLabel}>{t.label}</Text>
                <View style={styles.cardMeta}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{RECURRENCE_LABEL[t.recurrence]}</Text>
                  </View>
                  <Text style={styles.cardAmount}>
                    {t.amount > 0 ? formatRupiah(t.amount) : 'Variable'}
                  </Text>
                </View>
              </View>
              <Switch
                value={!!t.is_active}
                onValueChange={(v) => void handleToggle(t, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
      backgroundColor: c.surface,
    },
    title: { fontSize: 20, fontWeight: '800', color: c.text, fontFamily: F.b },
    list: { padding: 20, paddingBottom: 40, gap: 10 },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: c.border, gap: 12,
    },
    cardInactive: { opacity: 0.5 },
    cardMain: { flex: 1, gap: 6 },
    cardLabel: { fontSize: 15, fontWeight: '700', color: c.text, fontFamily: F.b },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badge: {
      backgroundColor: c.surface, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: c.border,
    },
    badgeText: { fontSize: 11, fontWeight: '600', color: c.muted, fontFamily: F.sb },
    cardAmount: { fontSize: 13, fontWeight: '600', color: c.text, fontFamily: F.sb },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, fontFamily: F.b },
    emptyText: {
      fontSize: 13, color: c.muted, textAlign: 'center',
      paddingHorizontal: 40, fontFamily: F.r,
    },
  });
}
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/recurring.tsx
git commit -m "feat(recurring): list screen"
```

---

### Task 5: recurring-form.tsx — Form create/edit

**Files:**
- Create: `app/(app)/recurring-form.tsx`

**Interfaces:**
- Consumes: `saveRecurringTemplate()`, `deleteRecurringTemplate()`, `getRecurringTemplate()`, `type SaveRecurringTemplateInput`, `type Recurrence`, `getWallets()`, `getCategories()`
- Params: `{ id?: string }` — ada id = mode edit, tidak ada = mode create

- [ ] **Step 1: Buat app/(app)/recurring-form.tsx**

```tsx
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { getWallets } from '../../lib/wallets';
import { getCategories } from '../../lib/categories';
import {
  deleteRecurringTemplate, getRecurringTemplate,
  saveRecurringTemplate, type Recurrence, type SaveRecurringTemplateInput,
} from '../../lib/recurring';
import { formatDateShort } from '../../lib/format';
import { useThemeColors, type AppColors, F } from '../../lib/ThemeProvider';
import type { Category, TransactionType, Wallet } from '../../lib/types';

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'Expense', label: 'Pengeluaran' },
  { value: 'Income', label: 'Pemasukan' },
  { value: 'Transfer', label: 'Transfer' },
];

export default function RecurringForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState('');
  const [type, setType] = useState<TransactionType>('Expense');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [destWalletId, setDestWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [timeHour, setTimeHour] = useState(8);
  const [timeMinute, setTimeMinute] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [w, c] = await Promise.all([getWallets(), getCategories()]);
        setWallets(w);
        setCategories(c);
        if (isEdit && id) {
          const t = await getRecurringTemplate(id);
          setLabel(t.label);
          setType(t.transaction_type);
          setWalletId(t.wallet_id);
          setDestWalletId(t.destination_wallet_id);
          setCategoryId(t.category_id);
          setAmount(t.amount > 0 ? String(Math.round(t.amount)) : '');
          setRecurrence(t.recurrence);
          setStartDate(new Date(t.next_due_at));
          setTimeHour(t.time_hour);
          setTimeMinute(t.time_minute);
          setIsActive(!!t.is_active);
        } else if (w.length > 0) {
          setWalletId(w[0].id);
        }
      } catch (e) {
        Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const categoryOptions = categories.filter((c) => c.category_type === type);

  function openDatePicker() {
    DateTimePickerAndroid.open({
      value: startDate, mode: 'date', display: 'calendar',
      onChange: (_: DateTimePickerEvent, selected?: Date) => {
        if (selected) setStartDate(selected);
      },
    });
  }

  function openTimePicker() {
    const d = new Date();
    d.setHours(timeHour, timeMinute);
    DateTimePickerAndroid.open({
      value: d, mode: 'time', is24Hour: true, display: 'clock',
      onChange: (_: DateTimePickerEvent, selected?: Date) => {
        if (selected) {
          setTimeHour(selected.getHours());
          setTimeMinute(selected.getMinutes());
        }
      },
    });
  }

  async function onSave() {
    if (!label.trim()) { Alert.alert('Label wajib diisi'); return; }
    if (!walletId) { Alert.alert('Pilih dompet'); return; }
    if (type === 'Transfer' && !destWalletId) { Alert.alert('Pilih dompet tujuan'); return; }
    if (type !== 'Transfer' && !categoryId) { Alert.alert('Pilih kategori'); return; }

    setSaving(true);
    try {
      const input: SaveRecurringTemplateInput = {
        id: isEdit ? id : undefined,
        label: label.trim(),
        wallet_id: walletId,
        destination_wallet_id: type === 'Transfer' ? destWalletId : null,
        category_id: categoryId ?? '',
        transaction_type: type,
        amount: Number(amount.replace(/[^0-9]/g, '')) || 0,
        notes: null,
        recurrence,
        day_of_month: recurrence === 'monthly' ? startDate.getDate() : null,
        time_hour: timeHour,
        time_minute: timeMinute,
        start_date: startDate,
        is_active: isActive,
      };
      await saveRecurringTemplate(input);
      router.back();
    } catch (e) {
      Alert.alert('Gagal simpan', e instanceof Error ? e.message : 'Error');
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert('Hapus template?', `"${label}" akan dihapus permanen.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecurringTemplate(id!);
            router.back();
          } catch (e) {
            Alert.alert('Gagal hapus', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const timeLabel = `${String(timeHour).padStart(2, '0')}:${String(timeMinute).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Batal</Text>
        </Pressable>
        <Text style={styles.topTitle}>{isEdit ? 'Edit Rutin' : 'Rutin Baru'}</Text>
        <Pressable onPress={() => void onSave()} disabled={saving} hitSlop={8}>
          <Text style={[styles.save, saving && { opacity: 0.5 }]}>Simpan</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Label</Text>
          <TextInput
            style={styles.input}
            placeholder="cth. Bayar Kos, Gaji, Listrik"
            placeholderTextColor={colors.muted}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.label}>Tipe</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                style={[styles.typeChip, type === t.value && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{type === 'Transfer' ? 'Dari dompet' : 'Dompet'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {wallets.map((w) => (
              <Pressable
                key={w.id}
                onPress={() => setWalletId(w.id)}
                style={[styles.chip, walletId === w.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, walletId === w.id && styles.chipTextActive]}>
                  {w.wallet_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {type === 'Transfer' && (
            <>
              <Text style={styles.label}>Ke dompet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {wallets.filter((w) => w.id !== walletId).map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => setDestWalletId(w.id)}
                    style={[styles.chip, destWalletId === w.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, destWalletId === w.id && styles.chipTextActive]}>
                      {w.wallet_name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {type !== 'Transfer' && (
            <>
              <Text style={styles.label}>Kategori</Text>
              {categoryOptions.length === 0 ? (
                <Text style={styles.muted}>
                  Belum ada kategori. Tambahkan dulu di menu Kategori.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {categoryOptions.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategoryId(c.id)}
                      style={[styles.chip, categoryId === c.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                        {`${c.icon_name ?? ''} ${c.category_name}`.trim()}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          <Text style={styles.label}>Nominal (kosongkan = variable)</Text>
          <View style={styles.amountBox}>
            <Text style={styles.amountPrefix}>Rp</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <Text style={styles.label}>Frekuensi</Text>
          <View style={styles.typeRow}>
            {RECURRENCE_OPTIONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRecurrence(r.value)}
                style={[styles.typeChip, recurrence === r.value && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, recurrence === r.value && styles.typeChipTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Tanggal mulai</Text>
          <Pressable style={styles.dateBtn} onPress={openDatePicker}>
            <Text style={styles.dateText}>{formatDateShort(startDate.toISOString())}</Text>
            <Feather name="calendar" size={18} color={colors.muted} />
          </Pressable>

          <Text style={styles.label}>Jam pengingat</Text>
          <Pressable style={styles.dateBtn} onPress={openTimePicker}>
            <Text style={styles.dateText}>{timeLabel}</Text>
            <Feather name="clock" size={18} color={colors.muted} />
          </Pressable>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Aktif</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEdit ? 'Simpan Perubahan' : 'Simpan Template'}
              </Text>
            )}
          </Pressable>

          {isEdit && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Feather name="trash-2" size={16} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Hapus Template</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    cancel: { fontSize: 16, color: c.muted, fontWeight: '600', fontFamily: F.sb },
    topTitle: { fontSize: 17, fontWeight: '800', color: c.text, fontFamily: F.b },
    save: { fontSize: 16, color: c.primary, fontWeight: '800', fontFamily: F.b },
    container: { padding: 20, paddingBottom: 40, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: c.text, marginTop: 16, marginBottom: 8, fontFamily: F.sb },
    muted: { fontSize: 13, color: c.muted, fontFamily: F.r },
    input: {
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: c.text, fontFamily: F.r,
    },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: c.border, backgroundColor: c.surface, alignItems: 'center',
    },
    typeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    typeChipText: { fontSize: 13, fontWeight: '700', color: c.text, fontFamily: F.b },
    typeChipTextActive: { color: '#fff' },
    chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
    chip: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 14, fontWeight: '600', color: c.text, fontFamily: F.sb },
    chipTextActive: { color: '#fff' },
    amountBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
      borderWidth: 1.5, borderColor: c.border, borderRadius: 16,
      paddingHorizontal: 18, paddingVertical: 10,
    },
    amountPrefix: { fontSize: 22, fontWeight: '800', color: c.muted, marginRight: 8, fontFamily: F.b },
    amountInput: { flex: 1, fontSize: 30, fontWeight: '800', color: c.text, paddingVertical: 6 },
    dateBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    },
    dateText: { fontSize: 15, fontWeight: '600', color: c.text, fontFamily: F.sb },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: c.text, fontFamily: F.sb },
    saveBtn: {
      backgroundColor: c.primary, borderRadius: 14, paddingVertical: 17,
      alignItems: 'center', marginTop: 28,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: F.b },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginTop: 14, paddingVertical: 14,
    },
    deleteBtnText: { color: c.danger, fontSize: 15, fontWeight: '700', fontFamily: F.b },
  });
}
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/recurring-form.tsx
git commit -m "feat(recurring): create/edit form screen"
```

---

### Task 6: Routes + Profile menu item

**Files:**
- Modify: `app/(app)/_layout.tsx`
- Modify: `app/(app)/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: layar `recurring` dan `recurring-form` dari Task 4 & 5
- Produces: navigasi dari profile ke layar recurring; route tersedia di stack

- [ ] **Step 1: Daftarkan route baru di app/(app)/_layout.tsx**

Ganti seluruh isi file dengan:

```tsx
import { Stack } from 'expo-router';

export default function AppStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="recurring" />
      <Stack.Screen name="recurring-form" />
      <Stack.Screen name="transaction-form" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Tambah menu item "Transaksi Rutin" di profile.tsx**

Di `profile.tsx`, dalam blok `{/* Menu */}`, setelah `<MenuItem icon="tag" .../>` dan sebelum `{!isGuest ? ...}`, tambah:

```tsx
<View style={styles.menuDivider} />
<MenuItem
  icon="repeat"
  label="Transaksi Rutin"
  onPress={() => router.push('/recurring')}
  colors={colors}
/>
```

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/_layout.tsx app/(app)/(tabs)/profile.tsx
git commit -m "feat(recurring): register routes + profile menu entry"
```

---

### Task 7: Root layout — notification listener + stale reschedule

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `rescheduleStaleTemplates()` dari `lib/recurring`, `Notifications` dari `expo-notifications`
- Produces: tap notif → navigate ke `/transaction-form` dengan params prefill; stale templates di-reschedule saat app foreground

- [ ] **Step 1: Tambah import ke app/_layout.tsx**

Di baris import `expo-router` yang sudah ada (`import { Slot, useRouter, useSegments } from 'expo-router'`), tambah `router`:

```tsx
import { Slot, router, useRouter, useSegments } from 'expo-router';
```

Tambah dua import baru setelah import yang sudah ada:

```tsx
import { rescheduleStaleTemplates } from '../lib/recurring';
```

(Catatan: `import * as Notifications` dan `Notifications.setNotificationHandler` sudah ditambahkan di Task 1.)

- [ ] **Step 2: Tambah rescheduleStaleTemplates dan notification response listener ke AppLayout useEffect**

Ganti `useEffect` yang ada di `AppLayout` dengan:

```tsx
useEffect(() => {
  updateWidgetsSoon();
  void rescheduleStaleTemplates();

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('recurring', {
      name: 'Transaksi Rutin',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      updateWidgetsSoon();
      void rescheduleStaleTemplates();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      templateId?: string;
      transactionType?: string;
      walletId?: string;
      categoryId?: string;
      destinationWalletId?: string | null;
      amount?: number;
      notes?: string | null;
    };
    if (data?.templateId) {
      router.push({
        pathname: '/(app)/transaction-form',
        params: {
          templateId: data.templateId,
          prefillType: data.transactionType ?? '',
          prefillWalletId: data.walletId ?? '',
          prefillCategoryId: data.categoryId ?? '',
          prefillDestWalletId: data.destinationWalletId ?? '',
          prefillAmount: String(data.amount ?? 0),
          prefillNotes: data.notes ?? '',
        },
      });
    }
  });

  return () => {
    appStateSub.remove();
    notifSub.remove();
  };
}, []);
```

Tambah `Platform` ke import React Native yang sudah ada di file ini.

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(recurring): notification response listener + stale reschedule on foreground"
```

---

### Task 8: transaction-form.tsx — terima prefill params + reschedule setelah save

**Files:**
- Modify: `app/(app)/transaction-form.tsx`

**Interfaces:**
- Consumes: `rescheduleAfterConfirm(templateId)` dari `lib/recurring`
- New params: `templateId`, `prefillType`, `prefillWalletId`, `prefillCategoryId`, `prefillDestWalletId`, `prefillAmount`, `prefillNotes`

- [ ] **Step 1: Tambah import rescheduleAfterConfirm**

Di bagian import atas `transaction-form.tsx`, tambah:

```tsx
import { rescheduleAfterConfirm } from '../../lib/recurring';
```

- [ ] **Step 2: Extend useLocalSearchParams untuk menerima prefill params**

Ganti baris `useLocalSearchParams` yang ada:

```tsx
const { id } = useLocalSearchParams<{ id?: string }>();
```

Dengan:

```tsx
const {
  id,
  templateId,
  prefillType,
  prefillWalletId,
  prefillCategoryId,
  prefillDestWalletId,
  prefillAmount,
  prefillNotes,
} = useLocalSearchParams<{
  id?: string;
  templateId?: string;
  prefillType?: string;
  prefillWalletId?: string;
  prefillCategoryId?: string;
  prefillDestWalletId?: string;
  prefillAmount?: string;
  prefillNotes?: string;
}>();
```

- [ ] **Step 3: Terapkan prefill saat load (hanya di mode buat baru)**

Di dalam `useEffect` loading (blok `else if (w.length > 0)` di sekitar baris 72), ganti:

```tsx
} else if (w.length > 0) {
  setWalletId(w[0].id);
}
```

Dengan:

```tsx
} else if (prefillType) {
  // Pre-fill dari notifikasi transaksi rutin
  setType((prefillType as TransactionType) || 'Expense');
  if (prefillWalletId) setWalletId(prefillWalletId);
  if (prefillCategoryId) setCategoryId(prefillCategoryId);
  if (prefillDestWalletId) setDestWalletId(prefillDestWalletId);
  if (prefillAmount && prefillAmount !== '0') setAmount(prefillAmount);
  if (prefillNotes) setNotes(prefillNotes);
} else if (w.length > 0) {
  setWalletId(w[0].id);
}
```

- [ ] **Step 4: Panggil rescheduleAfterConfirm setelah save berhasil**

Di fungsi `onSave`, setelah `await updateTransaction(...)` atau `await createTransaction(...)`, dan sebelum `router.back()`, tambah:

```tsx
if (templateId) {
  await rescheduleAfterConfirm(templateId).catch(() => {});
}
router.back();
```

Pastikan kedua cabang (create dan edit) memanggil ini. Blok try di `onSave` setelah payload menjadi:

```tsx
if (isEdit && id) {
  await updateTransaction(id, payload);
} else {
  await createTransaction(payload);
}
if (templateId) {
  await rescheduleAfterConfirm(templateId).catch(() => {});
}
router.back();
```

- [ ] **Step 5: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 6: Bump version di app.json**

Buka `app.json`, naikkan `version` ke minor berikutnya (misal `0.4.x` → `0.5.0`) karena ini fitur baru yang signifikan.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/transaction-form.tsx app.json
git commit -m "feat(recurring): transaction-form accepts prefill params + reschedules after save"
```

---

## Cara Test Manual

1. Buka Profile → tap "Transaksi Rutin"
2. Tap `+` → isi form (label: "Test", Expense, dompet, kategori, nominal: 50000, frekuensi: Harian, tanggal besok, jam sekarang + 2 menit)
3. Tap Simpan → kembali ke list → template muncul
4. Tunggu 2 menit → notifikasi muncul di tray
5. Tap notifikasi → transaction-form terbuka, pre-filled dengan data template
6. Tap Simpan → transaksi tersimpan, template list di-refresh
7. Kembali ke recurring screen → `next_due_at` bergeser ke hari berikutnya
8. Toggle switch di list → template non-aktif (notif dibatalkan)
9. Toggle aktif lagi → notif baru terjadwal

**Test stale reschedule:**
1. Set template dengan jam yang sudah lewat hari ini
2. Kill app
3. Buka kembali app → cek di recurring-form, `next_due_at` sudah di-advance ke hari berikutnya
