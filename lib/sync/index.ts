import { supabase } from '../supabase';
import { getDb, runExclusive, type SQLiteCtx } from '../db';
import { emitSynced } from './bus';
import { updateWidgetsSoon } from '../widget/snapshot';

export { onSynced } from './bus';
export { useRefreshOnSync } from './useRefreshOnSync';

// ── State engine ─────────────────────────────────────────────────────────────
let syncing = false;
let queued = false;
let debounce: ReturnType<typeof setTimeout> | null = null;

// Dipanggil setelah setiap mutasi lokal. Di-debounce supaya beberapa perubahan
// beruntun jadi satu kali sync.
export function syncSoon(delayMs = 1200): void {
  updateWidgetsSoon(); // refresh widget tiap mutasi (jalan utk tamu & login)
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void syncNow();
  }, delayMs);
}

// Satu siklus penuh: PUSH dulu (perubahan lokal -> server) lalu PULL
// (server -> lokal). Push-dulu penting agar saldo otoritatif yang kita PULL
// sudah memuat transaksi lokal kita. Aman dipanggil kapan saja; kalau offline /
// belum login, gagal diam-diam dan dicoba lagi pada trigger berikutnya.
export async function syncNow(): Promise<void> {
  if (syncing) {
    queued = true;
    return;
  }
  // Gerbang: sync HANYA untuk sesi Supabase asli. Tamu (tanpa sesi) tidak pernah
  // menyentuh cloud meski currentUserId mengembalikan id tamu untuk data lokal.
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return;

  syncing = true;
  try {
    do {
      queued = false;
      const db = await getDb();
      await pushAll(db, uid);
      const changed = await pullAll(db);
      if (changed) {
        emitSynced();
        updateWidgetsSoon();
      }
    } while (queued);
  } catch (e) {
    // Data sudah aman di SQLite — diamkan, akan dicoba lagi nanti.
    if (__DEV__) console.warn('[sync] tertunda:', e instanceof Error ? e.message : String(e));
  } finally {
    syncing = false;
  }
}

// ── PUSH ─────────────────────────────────────────────────────────────────────
async function pushAll(db: SQLiteCtx, uid: string): Promise<void> {
  // Urutan mengikuti foreign key: wallets -> categories -> transactions -> recurring_templates.
  // Filter user_id = uid: jangan pernah push baris milik tamu / user lain.
  await pushWallets(db, uid);
  await pushCategories(db, uid);
  await pushTransactions(db, uid);
  await pushRecurringTemplates(db, uid);
}

interface WalletRow {
  id: string; user_id: string; wallet_name: string; wallet_type: string;
  current_balance: number; initial_balance: number; created_at: string;
  updated_at: string; deleted_at: string | null; dirty: number; server_synced: number;
}

async function pushWallets(db: SQLiteCtx, uid: string): Promise<void> {
  const rows = await db.getAllAsync<WalletRow>('select * from wallets where dirty = 1 and user_id = ?', [uid]);
  for (const r of rows) {
    if (!r.server_synced) {
      // Insert pertama: kirim initial_balance sebagai current_balance.
      // Trigger server lalu menyesuaikan saldo dari transaksi yang menyusul.
      const { data, error } = await supabase
        .from('wallets')
        .insert({
          id: r.id, user_id: r.user_id, wallet_name: r.wallet_name,
          wallet_type: r.wallet_type, current_balance: r.initial_balance,
          created_at: r.created_at, deleted_at: r.deleted_at,
        })
        .select('updated_at')
        .single();
      if (error) throw error;
      await runExclusive(() =>
        db.runAsync('update wallets set dirty = 0, server_synced = 1, updated_at = ? where id = ?', [data.updated_at, r.id]),
      );
    } else {
      // Update: HANYA metadata + deleted_at. JANGAN pernah kirim current_balance
      // (otoritas server, dijaga trigger).
      const { data, error } = await supabase
        .from('wallets')
        .update({ wallet_name: r.wallet_name, wallet_type: r.wallet_type, deleted_at: r.deleted_at })
        .eq('id', r.id)
        .select('updated_at')
        .maybeSingle();
      if (error) throw error;
      await runExclusive(() =>
        db.runAsync('update wallets set dirty = 0, updated_at = ? where id = ?', [data?.updated_at ?? r.updated_at, r.id]),
      );
    }
  }
}

interface CategoryRow {
  id: string; user_id: string; category_name: string; category_type: string;
  icon_name: string | null; color_hex: string | null; created_at: string;
  updated_at: string; deleted_at: string | null;
}

async function pushCategories(db: SQLiteCtx, uid: string): Promise<void> {
  const rows = await db.getAllAsync<CategoryRow>('select * from categories where dirty = 1 and user_id = ?', [uid]);
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    id: r.id, user_id: r.user_id, category_name: r.category_name,
    category_type: r.category_type, icon_name: r.icon_name, color_hex: r.color_hex,
    created_at: r.created_at, deleted_at: r.deleted_at,
  }));
  const { data, error } = await supabase
    .from('categories')
    .upsert(payload, { onConflict: 'id' })
    .select('id, updated_at');
  if (error) throw error;
  const stamp = new Map<string, string>();
  for (const d of (data ?? []) as any[]) stamp.set(d.id, d.updated_at);
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(
          'update categories set dirty = 0, server_synced = 1, updated_at = ? where id = ?',
          [stamp.get(r.id) ?? r.updated_at, r.id],
        );
      }
    }),
  );
}

interface TransactionRow {
  id: string; user_id: string; wallet_id: string; destination_wallet_id: string | null;
  category_id: string | null; transaction_type: string; amount: number; notes: string | null;
  transaction_date: string; updated_at: string; deleted_at: string | null;
}

async function pushTransactions(db: SQLiteCtx, uid: string): Promise<void> {
  const rows = await db.getAllAsync<TransactionRow>('select * from transactions where dirty = 1 and user_id = ?', [uid]);
  if (rows.length === 0) return;
  // Upsert aman & idempoten: trigger server mem-balik efek lama lalu menerapkan
  // efek baru, jadi push ulang nilai sama = nol perubahan saldo.
  // (transactions tidak punya created_at.)
  const payload = rows.map((r) => ({
    id: r.id, user_id: r.user_id, wallet_id: r.wallet_id,
    destination_wallet_id: r.destination_wallet_id, category_id: r.category_id,
    transaction_type: r.transaction_type, amount: r.amount, notes: r.notes,
    transaction_date: r.transaction_date, deleted_at: r.deleted_at,
  }));
  const { data, error } = await supabase
    .from('transactions')
    .upsert(payload, { onConflict: 'id' })
    .select('id, updated_at');
  if (error) throw error;
  const stamp = new Map<string, string>();
  for (const d of (data ?? []) as any[]) stamp.set(d.id, d.updated_at);
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(
          'update transactions set dirty = 0, server_synced = 1, updated_at = ? where id = ?',
          [stamp.get(r.id) ?? r.updated_at, r.id],
        );
      }
    }),
  );
}

interface RecurringTemplateRow {
  id: string; user_id: string; label: string; wallet_id: string;
  destination_wallet_id: string | null; category_id: string; transaction_type: string;
  amount: number; notes: string | null; recurrence: string; day_of_month: number | null;
  time_hour: number; time_minute: number; next_due_at: string; notification_id: string | null;
  is_active: number; created_at: string; updated_at: string; deleted_at: string | null;
  dirty: number; server_synced: number;
}

async function pushRecurringTemplates(db: SQLiteCtx, uid: string): Promise<void> {
  const rows = await db.getAllAsync<RecurringTemplateRow>(
    'select * from recurring_templates where dirty = 1 and user_id = ?',
    [uid],
  );
  if (rows.length === 0) return;
  // notification_id adalah device-specific — jangan pernah push nilai aslinya.
  const payload = rows.map((r) => ({
    id: r.id, user_id: r.user_id, label: r.label, wallet_id: r.wallet_id,
    destination_wallet_id: r.destination_wallet_id, category_id: r.category_id,
    transaction_type: r.transaction_type, amount: r.amount, notes: r.notes,
    recurrence: r.recurrence, day_of_month: r.day_of_month,
    time_hour: r.time_hour, time_minute: r.time_minute, next_due_at: r.next_due_at,
    is_active: r.is_active, created_at: r.created_at, deleted_at: r.deleted_at,
    notification_id: null,
  }));
  const { data, error } = await supabase
    .from('recurring_templates')
    .upsert(payload, { onConflict: 'id' })
    .select('id, updated_at');
  if (error) throw error;
  const stamp = new Map<string, string>();
  for (const d of (data ?? []) as any[]) stamp.set(d.id, d.updated_at);
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(
          'update recurring_templates set dirty = 0, server_synced = 1, updated_at = ? where id = ?',
          [stamp.get(r.id) ?? r.updated_at, r.id],
        );
      }
    }),
  );
}

// ── PULL ─────────────────────────────────────────────────────────────────────
const PULL_TABLES = ['wallets', 'categories', 'transactions', 'recurring_templates'] as const;
type PullTable = (typeof PULL_TABLES)[number];

async function pullAll(db: SQLiteCtx): Promise<boolean> {
  let changed = false;
  for (const t of PULL_TABLES) {
    const n = await pullTable(db, t);
    if (n > 0) changed = true;
  }
  return changed;
}

async function pullTable(db: SQLiteCtx, table: PullTable): Promise<number> {
  const meta = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    'select last_pulled_at from sync_meta where table_name = ?',
    [table],
  );
  const cursor = meta?.last_pulled_at ?? '1970-01-01T00:00:00.000Z';

  // RLS sudah memfilter ke user yang login. Ambil yang berubah sejak cursor,
  // termasuk tombstone (deleted_at terisi).
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .gt('updated_at', cursor)
    .order('updated_at', { ascending: true })
    .limit(1000);
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      let maxUpdated = cursor;
      for (const r of data as any[]) {
        await mergeRow(db, table, r);
        if (r.updated_at > maxUpdated) maxUpdated = r.updated_at;
      }
      await db.runAsync(
        `insert into sync_meta (table_name, last_pulled_at) values (?, ?)
         on conflict(table_name) do update set last_pulled_at = excluded.last_pulled_at`,
        [table, maxUpdated],
      );
    }),
  );
  return data.length;
}

// LWW + proteksi baris lokal yang masih dirty (belum ter-push).
async function mergeRow(db: SQLiteCtx, table: PullTable, r: any): Promise<void> {
  const local = await db.getFirstAsync<{ updated_at: string; dirty: number }>(
    `select updated_at, dirty from ${table} where id = ?`,
    [r.id],
  );
  if (local) {
    if (local.dirty === 1) return; // perubahan lokal belum ter-push -> menang
    if (local.updated_at >= r.updated_at) return; // lokal sama/lebih baru
  }

  if (table === 'wallets') {
    await db.runAsync(
      `insert into wallets (id,user_id,wallet_name,wallet_type,current_balance,initial_balance,created_at,updated_at,deleted_at,dirty,server_synced)
       values (?,?,?,?,?,?,?,?,?,0,1)
       on conflict(id) do update set
         user_id=excluded.user_id, wallet_name=excluded.wallet_name, wallet_type=excluded.wallet_type,
         current_balance=excluded.current_balance, created_at=excluded.created_at,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, dirty=0, server_synced=1`,
      [r.id, r.user_id, r.wallet_name, r.wallet_type, r.current_balance, r.current_balance,
        r.created_at, r.updated_at, r.deleted_at],
    );
  } else if (table === 'categories') {
    await db.runAsync(
      `insert into categories (id,user_id,category_name,category_type,icon_name,color_hex,created_at,updated_at,deleted_at,dirty,server_synced)
       values (?,?,?,?,?,?,?,?,?,0,1)
       on conflict(id) do update set
         user_id=excluded.user_id, category_name=excluded.category_name, category_type=excluded.category_type,
         icon_name=excluded.icon_name, color_hex=excluded.color_hex, created_at=excluded.created_at,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, dirty=0, server_synced=1`,
      [r.id, r.user_id, r.category_name, r.category_type, r.icon_name, r.color_hex,
        r.created_at, r.updated_at, r.deleted_at],
    );
  } else if (table === 'recurring_templates') {
    // notification_id adalah device-specific — jangan timpa nilai lokal dengan null dari server.
    await db.runAsync(
      `insert into recurring_templates
         (id,user_id,label,wallet_id,destination_wallet_id,category_id,transaction_type,
          amount,notes,recurrence,day_of_month,time_hour,time_minute,next_due_at,
          notification_id,is_active,created_at,updated_at,deleted_at,dirty,server_synced)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,null,?,?,?,?,0,1)
       on conflict(id) do update set
         user_id=excluded.user_id, label=excluded.label, wallet_id=excluded.wallet_id,
         destination_wallet_id=excluded.destination_wallet_id, category_id=excluded.category_id,
         transaction_type=excluded.transaction_type, amount=excluded.amount, notes=excluded.notes,
         recurrence=excluded.recurrence, day_of_month=excluded.day_of_month,
         time_hour=excluded.time_hour, time_minute=excluded.time_minute,
         next_due_at=excluded.next_due_at,
         is_active=excluded.is_active, created_at=excluded.created_at,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
         dirty=0, server_synced=1`,
      [r.id, r.user_id, r.label, r.wallet_id, r.destination_wallet_id, r.category_id,
        r.transaction_type, r.amount, r.notes, r.recurrence, r.day_of_month,
        r.time_hour, r.time_minute, r.next_due_at,
        r.is_active, r.created_at, r.updated_at, r.deleted_at],
    );
  } else {
    // transactions: tanpa created_at.
    await db.runAsync(
      `insert into transactions (id,user_id,wallet_id,destination_wallet_id,category_id,transaction_type,amount,notes,transaction_date,updated_at,deleted_at,dirty,server_synced)
       values (?,?,?,?,?,?,?,?,?,?,?,0,1)
       on conflict(id) do update set
         user_id=excluded.user_id, wallet_id=excluded.wallet_id, destination_wallet_id=excluded.destination_wallet_id,
         category_id=excluded.category_id, transaction_type=excluded.transaction_type, amount=excluded.amount,
         notes=excluded.notes, transaction_date=excluded.transaction_date,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, dirty=0, server_synced=1`,
      [r.id, r.user_id, r.wallet_id, r.destination_wallet_id, r.category_id, r.transaction_type,
        r.amount, r.notes, r.transaction_date, r.updated_at, r.deleted_at],
    );
  }
}
