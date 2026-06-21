import { supabase } from '../supabase';
import { guestUserId } from '../guest';

// user_id "aktif" untuk operasi data lokal:
//   - kalau ada sesi Supabase asli -> id user itu (prioritas; menang saat transisi login)
//   - kalau tidak, tapi mode tamu aktif -> id tamu lokal
//   - kalau tidak keduanya -> null (belum login & bukan tamu)
// getSession() membaca sesi tersimpan secara LOKAL, tetap jalan walau offline.

export async function currentUserIdOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;
  return guestUserId();
}

export async function currentUserId(): Promise<string> {
  const id = await currentUserIdOrNull();
  if (!id) throw new Error('Belum login.');
  return id;
}
