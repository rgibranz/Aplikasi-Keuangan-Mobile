import { supabase } from './supabase';
import type { Transaction, TransactionType } from './types';

export type TransactionInput = {
  transaction_type: TransactionType;
  amount: number;
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string | null;
  notes: string | null;
  transaction_date: string; // ISO string
};

export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Transaction;
}

// Saldo dompet di-update otomatis oleh trigger DB — JANGAN sentuh current_balance dari sini.
export async function createTransaction(input: TransactionInput): Promise<void> {
  const { error } = await supabase.from('transactions').insert(input);
  if (error) throw error;
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<void> {
  const { error } = await supabase.from('transactions').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}
