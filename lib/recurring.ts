import * as Notifications from 'expo-notifications';
import { getDb } from './db';
import { currentUserId, currentUserIdOrNull } from './db/user';
import { uuidv4 } from './db/uuid';
import { nowIso } from './db/time';
import { syncSoon } from './sync';

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

let _notifPermGranted: boolean | null = null;
async function hasNotifPerm(): Promise<boolean> {
  if (_notifPermGranted !== null) return _notifPermGranted;
  const { status } = await Notifications.requestPermissionsAsync();
  _notifPermGranted = status === 'granted';
  return _notifPermGranted;
}

async function scheduleNotif(
  t: Pick<RecurringTemplate, 'id' | 'label' | 'transaction_type' | 'amount' | 'wallet_id' | 'category_id' | 'destination_wallet_id' | 'notes' | 'next_due_at'>,
): Promise<string | null> {
  const amountText =
    t.amount > 0
      ? `Rp ${Math.round(t.amount).toLocaleString('id-ID')}`
      : 'Ketuk untuk isi nominal';
  const typeLabel =
    t.transaction_type === 'Income' ? 'Pemasukan'
    : t.transaction_type === 'Expense' ? 'Pengeluaran'
    : 'Transfer';

  if (!(await hasNotifPerm())) return null;

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
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(t.next_due_at),
      channelId: 'recurring',
    },
  });
}

async function cancelNotif(notifId: string | null | undefined): Promise<void> {
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
    'select * from recurring_templates where id = ? and deleted_at is null',
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
       next_due_at=?,notification_id=?,is_active=?,updated_at=?,dirty=1 where id=?`,
      [input.label, input.wallet_id, input.destination_wallet_id, input.category_id,
       input.transaction_type, input.amount, input.notes, input.recurrence, input.day_of_month,
       input.time_hour, input.time_minute, nextDueAt.toISOString(), notifId, input.is_active ? 1 : 0, ts, input.id],
    );
    syncSoon();
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
        next_due_at,notification_id,is_active,created_at,updated_at,dirty,server_synced)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0)`,
      [id, uid, input.label, input.wallet_id, input.destination_wallet_id, input.category_id,
       input.transaction_type, input.amount, input.notes, input.recurrence, input.day_of_month,
       input.time_hour, input.time_minute, nextDueAt.toISOString(), notifId, input.is_active ? 1 : 0, ts, ts],
    );
    syncSoon();
  }
}

export async function deleteRecurringTemplate(id: string): Promise<void> {
  const t = await getRecurringTemplate(id);
  await cancelNotif(t.notification_id);
  const db = await getDb();
  const ts = nowIso();
  await db.runAsync(
    'update recurring_templates set deleted_at=?,updated_at=?,dirty=1 where id=?',
    [ts, ts, id],
  );
  syncSoon();
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  const t = await getRecurringTemplate(id);
  const db = await getDb();
  const ts = nowIso();
  if (!isActive) {
    await cancelNotif(t.notification_id);
    await db.runAsync(
      'update recurring_templates set is_active=0,notification_id=null,updated_at=?,dirty=1 where id=?',
      [ts, id],
    );
  } else {
    const nextDueAt = computeFirstDueAt(t.recurrence, new Date(), t.time_hour, t.time_minute, t.day_of_month);
    const notifId = await scheduleNotif({ ...t, next_due_at: nextDueAt.toISOString() });
    await db.runAsync(
      'update recurring_templates set is_active=1,next_due_at=?,notification_id=?,updated_at=?,dirty=1 where id=?',
      [nextDueAt.toISOString(), notifId, ts, id],
    );
  }
  syncSoon();
}

export async function rescheduleAfterConfirm(templateId: string): Promise<void> {
  const t = await getRecurringTemplate(templateId);
  if (!t.is_active) return;
  await cancelNotif(t.notification_id);
  const nextDueAt = computeNextDueAt(t.recurrence, new Date(t.next_due_at), t.time_hour, t.time_minute, t.day_of_month);
  const notifId = await scheduleNotif({ ...t, next_due_at: nextDueAt.toISOString() });
  const db = await getDb();
  const ts = nowIso();
  await db.runAsync(
    'update recurring_templates set next_due_at=?,notification_id=?,updated_at=?,dirty=1 where id=?',
    [nextDueAt.toISOString(), notifId, ts, t.id],
  );
  syncSoon();
}

// Dipanggil saat app kembali foreground. Kalau user dismiss notif tanpa tap,
// next_due_at tidak pernah di-advance — fungsi ini memperbaikinya.
export async function rescheduleStaleTemplates(): Promise<void> {
  const uid = await currentUserIdOrNull();
  if (!uid) return;
  const db = await getDb();
  const now = nowIso();
  const stale = await db.getAllAsync<RecurringTemplate>(
    'select * from recurring_templates where user_id=? and is_active=1 and deleted_at is null and next_due_at < ?',
    [uid, now],
  );
  for (const t of stale) {
    await cancelNotif(t.notification_id);
    let nextDueAt = new Date(t.next_due_at);
    const limit = new Date();
    while (nextDueAt <= limit) {
      nextDueAt = computeNextDueAt(t.recurrence, nextDueAt, t.time_hour, t.time_minute, t.day_of_month);
    }
    const notifId = await scheduleNotif({ ...t, next_due_at: nextDueAt.toISOString() });
    const ts = nowIso();
    await db.runAsync(
      'update recurring_templates set next_due_at=?,notification_id=?,updated_at=?,dirty=1 where id=?',
      [nextDueAt.toISOString(), notifId, ts, t.id],
    );
  }
  if (stale.length > 0) syncSoon();
}
