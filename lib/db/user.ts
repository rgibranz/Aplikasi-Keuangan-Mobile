import { guestUserId } from '../guest';

// User id sesi yang DI-CACHE di memori, di-set oleh AuthProvider tiap sesi
// berubah (login/logout/refresh). Dipakai di JALUR PANAS (baca/tulis lokal).
//
// Penting untuk performa offline-first: JANGAN panggil supabase.auth.getSession()
// di sini — getSession bisa lambat / nge-block saat refresh token atau internet
// lambat (rebutan lock dengan auto-refresh), sehingga tulis lokal yang harusnya
// instan jadi ikut lambat. Token refresh tidak mengubah user.id, jadi cache aman.
let cachedSessionUserId: string | null = null;

export function setSessionUserId(id: string | null): void {
  cachedSessionUserId = id;
}

// Prioritas sesi asli; kalau tidak ada, pakai id tamu (mode tamu).
export async function currentUserIdOrNull(): Promise<string | null> {
  return cachedSessionUserId ?? guestUserId();
}

export async function currentUserId(): Promise<string> {
  const id = await currentUserIdOrNull();
  if (!id) throw new Error('Belum login.');
  return id;
}
