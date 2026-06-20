// Satu sumber waktu untuk seluruh layer data lokal.
// Catatan: `updated_at` versi server selalu di-stempel ulang oleh trigger DB
// (lihat migrasi 0001) — nilai lokal ini hanya dipakai untuk LWW sementara
// sampai baris tersinkron.
export function nowIso(): string {
  return new Date().toISOString();
}
