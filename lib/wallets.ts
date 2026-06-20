import { supabase } from './supabase';
import type { Wallet, WalletType } from './types';

// Ambil semua dompet milik user yang sedang login (difilter otomatis oleh RLS).
export async function getWallets(): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Wallet[];
}

// Buat dompet baru. user_id TIDAK dikirim — terisi otomatis oleh
// default auth.uid() di database, lalu divalidasi oleh RLS.
export async function createWallet(input: {
  wallet_name: string;
  wallet_type: WalletType;
  current_balance: number;
}): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as Wallet;
}

// Hapus dompet (transaksi terkait ikut terhapus karena ON DELETE CASCADE).
export async function deleteWallet(id: string): Promise<void> {
  const { error } = await supabase.from('wallets').delete().eq('id', id);
  if (error) throw error;
}
