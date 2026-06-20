import { supabase } from '../supabase';

// getSession() membaca sesi tersimpan (terenkripsi) secara LOKAL — tetap jalan
// walau offline. Dipakai untuk mengisi user_id baris baru & memfilter query.

export async function currentUserIdOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function currentUserId(): Promise<string> {
  const id = await currentUserIdOrNull();
  if (!id) throw new Error('Belum login.');
  return id;
}
