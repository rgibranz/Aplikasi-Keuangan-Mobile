import { supabase } from './supabase';
import type { Category } from './types';

// Kategori hanya bertipe Income atau Expense (Transfer tidak butuh kategori).
export type CategoryType = 'Income' | 'Expense';

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(input: {
  category_name: string;
  category_type: CategoryType;
  icon_name: string;
  color_hex: string;
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}
