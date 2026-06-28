import { getDb, runExclusive } from './db';
import { currentUserId, currentUserIdOrNull } from './db/user';
import { uuidv4 } from './db/uuid';
import { nowIso } from './db/time';
import { syncSoon } from './sync';
import type { Category } from './types';

// Kategori hanya bertipe Income atau Expense (Transfer tidak butuh kategori).
export type CategoryType = 'Income' | 'Expense';

const COLS = 'id, user_id, category_name, category_type, icon_name, color_hex, created_at';

export async function getCategories(): Promise<Category[]> {
  const uid = await currentUserIdOrNull();
  if (!uid) return [];
  const db = await getDb();
  return db.getAllAsync<Category>(
    `select ${COLS} from categories where user_id = ? and deleted_at is null order by created_at asc`,
    [uid],
  );
}

export async function createCategory(input: {
  category_name: string;
  category_type: CategoryType;
  icon_name: string;
  color_hex: string;
}): Promise<Category> {
  const uid = await currentUserId();
  const db = await getDb();
  const now = nowIso();
  const id = uuidv4();
  await runExclusive(() =>
    db.runAsync(
      `insert into categories
         (id, user_id, category_name, category_type, icon_name, color_hex, created_at, updated_at, deleted_at, dirty, server_synced)
       values (?, ?, ?, ?, ?, ?, ?, ?, null, 1, 0)`,
      [id, uid, input.category_name, input.category_type, input.icon_name, input.color_hex, now, now],
    ),
  );
  syncSoon();
  return {
    id,
    user_id: uid,
    category_name: input.category_name,
    category_type: input.category_type,
    icon_name: input.icon_name,
    color_hex: input.color_hex,
    created_at: now,
  };
}

// Soft-delete: transaksi lama tetap menyimpan category_id-nya, tapi karena
// kategori ter-tombstone ia tak muncul di lookup -> tampil "tanpa kategori".
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await runExclusive(() =>
    db.runAsync(
      'update categories set deleted_at = ?, updated_at = ?, dirty = 1 where id = ?',
      [now, now, id],
    ),
  );
  syncSoon();
}

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
