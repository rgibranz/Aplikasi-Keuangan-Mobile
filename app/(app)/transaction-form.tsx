import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { getWallets } from '../../lib/wallets';
import { getCategories } from '../../lib/categories';
import {
  createTransaction,
  getTransaction,
  updateTransaction,
} from '../../lib/transactions';
import { formatDateShort } from '../../lib/format';
import { colors } from '../../lib/theme';
import type { Category, TransactionType, Wallet } from '../../lib/types';

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'Expense', label: 'Pengeluaran' },
  { value: 'Income', label: 'Pemasukan' },
  { value: 'Transfer', label: 'Transfer' },
];

export default function TransactionForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<TransactionType>('Expense');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [destWalletId, setDestWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [w, c] = await Promise.all([getWallets(), getCategories()]);
        setWallets(w);
        setCategories(c);
        if (isEdit && id) {
          const t = await getTransaction(id);
          setType(t.transaction_type);
          setAmount(String(Math.round(Number(t.amount))));
          setWalletId(t.wallet_id);
          setDestWalletId(t.destination_wallet_id);
          setCategoryId(t.category_id);
          setDate(new Date(t.transaction_date));
          setNotes(t.notes ?? '');
        } else if (w.length > 0) {
          setWalletId(w[0].id);
        }
      } catch (e) {
        Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const categoryOptions = categories.filter((c) => c.category_type === type);

  function openDatePicker() {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      display: 'calendar',
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === 'set' && selected) setDate(selected);
      },
    });
  }

  async function onSave() {
    const parsedAmount = Number(amount.replace(/[^0-9]/g, ''));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Jumlah belum valid', 'Masukkan jumlah lebih dari 0.');
      return;
    }
    if (!walletId) {
      Alert.alert('Pilih dompet', 'Dompet sumber wajib dipilih.');
      return;
    }
    if (type === 'Transfer') {
      if (!destWalletId) {
        Alert.alert('Pilih tujuan', 'Dompet tujuan transfer wajib dipilih.');
        return;
      }
      if (destWalletId === walletId) {
        Alert.alert('Tujuan sama', 'Dompet tujuan harus berbeda dari sumber.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        transaction_type: type,
        amount: parsedAmount,
        wallet_id: walletId,
        destination_wallet_id: type === 'Transfer' ? destWalletId : null,
        category_id: type === 'Transfer' ? null : categoryId,
        notes: notes.trim() || null,
        transaction_date: date.toISOString(),
      };
      if (isEdit && id) {
        await updateTransaction(id, payload);
      } else {
        await createTransaction(payload);
      }
      router.back();
    } catch (e) {
      Alert.alert('Gagal simpan', e instanceof Error ? e.message : 'Error');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (wallets.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>Batal</Text>
          </Pressable>
          <Text style={styles.topTitle}>Transaksi</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>👛</Text>
          <Text style={styles.emptyTitle}>Belum ada dompet</Text>
          <Text style={styles.emptyText}>
            Bikin dompet dulu sebelum mencatat transaksi.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Batal</Text>
        </Pressable>
        <Text style={styles.topTitle}>
          {isEdit ? 'Edit Transaksi' : 'Transaksi Baru'}
        </Text>
        <Pressable onPress={onSave} disabled={saving} hitSlop={8}>
          <Text style={[styles.save, saving && { opacity: 0.5 }]}>Simpan</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                style={[styles.typeChip, type === t.value && styles.typeChipActive]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    type === t.value && styles.typeChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountPrefix}>Rp</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <Text style={styles.label}>
            {type === 'Transfer' ? 'Dari dompet' : 'Dompet'}
          </Text>
          <ChipScroller
            items={wallets.map((w) => ({ id: w.id, label: w.wallet_name }))}
            selected={walletId}
            onSelect={setWalletId}
          />

          {type === 'Transfer' && (
            <>
              <Text style={styles.label}>Ke dompet</Text>
              <ChipScroller
                items={wallets
                  .filter((w) => w.id !== walletId)
                  .map((w) => ({ id: w.id, label: w.wallet_name }))}
                selected={destWalletId}
                onSelect={setDestWalletId}
              />
            </>
          )}

          {type !== 'Transfer' && (
            <>
              <Text style={styles.label}>Kategori</Text>
              {categoryOptions.length === 0 ? (
                <Text style={styles.muted}>
                  Belum ada kategori {type === 'Income' ? 'pemasukan' : 'pengeluaran'}.
                  Tambahkan dulu di menu Kategori.
                </Text>
              ) : (
                <ChipScroller
                  items={categoryOptions.map((c) => ({
                    id: c.id,
                    label: `${c.icon_name ?? ''} ${c.category_name}`.trim(),
                  }))}
                  selected={categoryId}
                  onSelect={setCategoryId}
                />
              )}
            </>
          )}

          <Text style={styles.label}>Tanggal</Text>
          <Pressable style={styles.dateBtn} onPress={openDatePicker}>
            <Text style={styles.dateText}>{formatDateShort(date.toISOString())}</Text>
            <Text style={styles.dateIcon}>📅</Text>
          </Pressable>

          <Text style={styles.label}>Catatan (opsional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="cth. Makan siang di kantin"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChipScroller({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {items.map((it) => (
        <Pressable
          key={it.id}
          onPress={() => onSelect(it.id)}
          style={[styles.chip, selected === it.id && styles.chipActive]}
        >
          <Text
            style={[styles.chipText, selected === it.id && styles.chipTextActive]}
            numberOfLines={1}
          >
            {it.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  save: { fontSize: 16, color: colors.primary, fontWeight: '800' },
  container: { padding: 20, paddingBottom: 40, gap: 6 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  typeChipTextActive: { color: '#fff' },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 6,
  },
  amountPrefix: { fontSize: 22, fontWeight: '800', color: colors.muted, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 30, fontWeight: '800', color: colors.text, paddingVertical: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#fff' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateText: { fontSize: 15, fontWeight: '600', color: colors.text },
  dateIcon: { fontSize: 18 },
  notesInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: 40 },
});
