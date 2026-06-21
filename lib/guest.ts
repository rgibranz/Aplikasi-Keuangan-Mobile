import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from './db/uuid';
import { getDb, runExclusive } from './db';

// ── Mode tamu (lokal saja, tanpa akun) ───────────────────────────────────────
// Identitas tamu = satu UUID lokal yang dibuat sekali & disimpan permanen di
// AsyncStorage. UUID itu jadi user_id semua data tamu di SQLite (tabel sama),
// jadi TIDAK perlu migrasi skema. Sync TIDAK pernah jalan untuk tamu.
//
// Snapshot in-memory (active/guestId) supaya layer data bisa membacanya cepat;
// di-hydrate sekali saat app start oleh AuthProvider.

const K_MODE = 'guest_mode'; // '1' = sedang mode tamu
const K_ID = 'guest_id'; // UUID tamu (persist walau keluar mode tamu)
const K_MIGRATE_EMAIL = 'guest_migrate_email'; // email yg didaftarkan tamu (utk migrasi)

let active = false;
let guestId: string | null = null;

export async function hydrateGuest(): Promise<void> {
  const [mode, id] = await Promise.all([
    AsyncStorage.getItem(K_MODE),
    AsyncStorage.getItem(K_ID),
  ]);
  guestId = id;
  active = mode === '1';
}

export function isGuestActive(): boolean {
  return active;
}

// user_id data saat mode tamu (null kalau bukan tamu).
export function guestUserId(): string | null {
  return active ? guestId : null;
}

export async function enterGuestMode(): Promise<string> {
  if (!guestId) {
    guestId = uuidv4();
    await AsyncStorage.setItem(K_ID, guestId);
  }
  active = true;
  await AsyncStorage.setItem(K_MODE, '1');
  return guestId;
}

// Keluar mode tamu — TAPI simpan guest_id agar data tamu tetap ada kalau nanti
// masuk mode tamu lagi.
export async function exitGuestMode(): Promise<void> {
  active = false;
  await AsyncStorage.setItem(K_MODE, '0');
}

// Niat migrasi: diset saat tamu DAFTAR (sign-up). Dicocokkan dgn email sesi
// yang terbentuk supaya hanya akun yang didaftarkan itu yang dimigrasi.
export async function setPendingMigrationEmail(email: string | null): Promise<void> {
  if (email) await AsyncStorage.setItem(K_MIGRATE_EMAIL, email);
  else await AsyncStorage.removeItem(K_MIGRATE_EMAIL);
}
export async function getPendingMigrationEmail(): Promise<string | null> {
  return AsyncStorage.getItem(K_MIGRATE_EMAIL);
}

// Pindahkan semua data tamu ke user_id akun asli, tandai dirty + belum-tersinkron
// supaya sync mem-push-nya sebagai data baru milik akun itu. Bukan migrasi
// skema — hanya UPDATE baris (runtime).
export async function migrateGuestDataToUser(realUid: string): Promise<void> {
  const gid = guestId;
  if (!gid || gid === realUid) return;
  const db = await getDb();
  await runExclusive(() =>
    db.withTransactionAsync(async () => {
      await db.runAsync('update wallets set user_id = ?, dirty = 1, server_synced = 0 where user_id = ?', [realUid, gid]);
      await db.runAsync('update categories set user_id = ?, dirty = 1, server_synced = 0 where user_id = ?', [realUid, gid]);
      await db.runAsync('update transactions set user_id = ?, dirty = 1, server_synced = 0 where user_id = ?', [realUid, gid]);
    }),
  );
}
