// Tipe data yang mencerminkan tabel di Supabase.
// Nanti bisa di-generate otomatis pakai Supabase CLI; untuk sekarang ditulis manual.

export type WalletType = 'Bank' | 'E-Wallet' | 'Cash' | 'Tabungan' | 'Investasi';
export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export interface Wallet {
  id: string;
  user_id: string;
  wallet_name: string;
  wallet_type: WalletType;
  current_balance: number;
  exclude_from_total: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  category_name: string;
  category_type: TransactionType;
  icon_name: string | null;
  color_hex: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  destination_wallet_id: string | null; // hanya terisi untuk Transfer
  category_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  notes: string | null;
  transaction_date: string;
}
