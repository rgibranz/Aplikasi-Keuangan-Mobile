import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';

// Tipe konteks query yang dipakai bersama oleh `db` dan `txn`
// (Transaction extends SQLiteDatabase, jadi keduanya kompatibel).
export type SQLiteCtx = SQLite.SQLiteDatabase;

// Singleton: memoize PROMISE-nya (bukan hasilnya) supaya pemanggilan paralel
// (beberapa layar fetch via Promise.all saat fokus) tetap membuka & migrasi
// SATU kali saja.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('uangkita.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db);
  return db;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openAndMigrate();
  return dbPromise;
}

// Mutex tulis: men-serialkan SEMUA operasi tulis (beserta transaksinya) pada
// SATU koneksi DB. Mencegah "database is locked" & transaksi bersarang yang
// muncul kalau beberapa penulisan (mis. sync + tap user) berjalan bersamaan.
// Operasi BACA tidak dikunci (boleh paralel — itu inti offline-first yang responsif).
let writeLock: Promise<unknown> = Promise.resolve();
export function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = writeLock.then(task, task);
  writeLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
