import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { getWallets } from '../../lib/wallets';
import { getCategories } from '../../lib/categories';
import {
  deleteRecurringTemplate, getRecurringTemplate,
  saveRecurringTemplate, type Recurrence, type SaveRecurringTemplateInput,
} from '../../lib/recurring';
import { formatDateShort } from '../../lib/format';
import { useThemeColors, type AppColors, F } from '../../lib/ThemeProvider';
import type { Category, TransactionType, Wallet } from '../../lib/types';

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'Expense', label: 'Pengeluaran' },
  { value: 'Income', label: 'Pemasukan' },
  { value: 'Transfer', label: 'Transfer' },
];

export default function RecurringForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState('');
  const [type, setType] = useState<TransactionType>('Expense');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [destWalletId, setDestWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [timeHour, setTimeHour] = useState(8);
  const [timeMinute, setTimeMinute] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [w, c] = await Promise.all([getWallets(), getCategories()]);
        setWallets(w);
        setCategories(c);
        if (isEdit && id) {
          const t = await getRecurringTemplate(id);
          setLabel(t.label);
          setType(t.transaction_type);
          setWalletId(t.wallet_id);
          setDestWalletId(t.destination_wallet_id);
          setCategoryId(t.category_id);
          setAmount(t.amount > 0 ? String(Math.round(t.amount)) : '');
          setRecurrence(t.recurrence);
          setStartDate(new Date(t.next_due_at));
          setTimeHour(t.time_hour);
          setTimeMinute(t.time_minute);
          setIsActive(!!t.is_active);
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
      value: startDate, mode: 'date', display: 'calendar',
      onChange: (_: DateTimePickerEvent, selected?: Date) => {
        if (selected) setStartDate(selected);
      },
    });
  }

  function openTimePicker() {
    const d = new Date();
    d.setHours(timeHour, timeMinute);
    DateTimePickerAndroid.open({
      value: d, mode: 'time', is24Hour: true, display: 'clock',
      onChange: (_: DateTimePickerEvent, selected?: Date) => {
        if (selected) {
          setTimeHour(selected.getHours());
          setTimeMinute(selected.getMinutes());
        }
      },
    });
  }

  async function onSave() {
    if (!label.trim()) { Alert.alert('Label wajib diisi'); return; }
    if (!walletId) { Alert.alert('Pilih dompet'); return; }
    if (type === 'Transfer' && !destWalletId) { Alert.alert('Pilih dompet tujuan'); return; }
    if (type !== 'Transfer' && !categoryId) { Alert.alert('Pilih kategori'); return; }

    setSaving(true);
    try {
      const input: SaveRecurringTemplateInput = {
        id: isEdit ? id : undefined,
        label: label.trim(),
        wallet_id: walletId,
        destination_wallet_id: type === 'Transfer' ? destWalletId : null,
        category_id: categoryId ?? '',
        transaction_type: type,
        amount: Number(amount.replace(/[^0-9]/g, '')) || 0,
        notes: null,
        recurrence,
        day_of_month: recurrence === 'monthly' ? startDate.getDate() : null,
        time_hour: timeHour,
        time_minute: timeMinute,
        start_date: startDate,
        is_active: isActive,
      };
      await saveRecurringTemplate(input);
      router.back();
    } catch (e) {
      Alert.alert('Gagal simpan', e instanceof Error ? e.message : 'Error');
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert('Hapus template?', `"${label}" akan dihapus permanen.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecurringTemplate(id!);
            router.back();
          } catch (e) {
            Alert.alert('Gagal hapus', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const timeLabel = `${String(timeHour).padStart(2, '0')}:${String(timeMinute).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Batal</Text>
        </Pressable>
        <Text style={styles.topTitle}>{isEdit ? 'Edit Rutin' : 'Rutin Baru'}</Text>
        <Pressable onPress={() => void onSave()} disabled={saving} hitSlop={8}>
          <Text style={[styles.save, saving && { opacity: 0.5 }]}>Simpan</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Label</Text>
          <TextInput
            style={styles.input}
            placeholder="cth. Bayar Kos, Gaji, Listrik"
            placeholderTextColor={colors.muted}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.label}>Tipe</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                style={[styles.typeChip, type === t.value && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{type === 'Transfer' ? 'Dari dompet' : 'Dompet'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {wallets.map((w) => (
              <Pressable
                key={w.id}
                onPress={() => setWalletId(w.id)}
                style={[styles.chip, walletId === w.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, walletId === w.id && styles.chipTextActive]}>
                  {w.wallet_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {type === 'Transfer' && (
            <>
              <Text style={styles.label}>Ke dompet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {wallets.filter((w) => w.id !== walletId).map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => setDestWalletId(w.id)}
                    style={[styles.chip, destWalletId === w.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, destWalletId === w.id && styles.chipTextActive]}>
                      {w.wallet_name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {type !== 'Transfer' && (
            <>
              <Text style={styles.label}>Kategori</Text>
              {categoryOptions.length === 0 ? (
                <Text style={styles.muted}>
                  Belum ada kategori. Tambahkan dulu di menu Kategori.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {categoryOptions.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategoryId(c.id)}
                      style={[styles.chip, categoryId === c.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                        {`${c.icon_name ?? ''} ${c.category_name}`.trim()}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          <Text style={styles.label}>Nominal (kosongkan = variable)</Text>
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

          <Text style={styles.label}>Frekuensi</Text>
          <View style={styles.typeRow}>
            {RECURRENCE_OPTIONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRecurrence(r.value)}
                style={[styles.typeChip, recurrence === r.value && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, recurrence === r.value && styles.typeChipTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Tanggal mulai</Text>
          <Pressable style={styles.dateBtn} onPress={openDatePicker}>
            <Text style={styles.dateText}>{formatDateShort(startDate.toISOString())}</Text>
            <Feather name="calendar" size={18} color={colors.muted} />
          </Pressable>

          <Text style={styles.label}>Jam pengingat</Text>
          <Pressable style={styles.dateBtn} onPress={openTimePicker}>
            <Text style={styles.dateText}>{timeLabel}</Text>
            <Feather name="clock" size={18} color={colors.muted} />
          </Pressable>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Aktif</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEdit ? 'Simpan Perubahan' : 'Simpan Template'}
              </Text>
            )}
          </Pressable>

          {isEdit && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Feather name="trash-2" size={16} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Hapus Template</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    cancel: { fontSize: 16, color: c.muted, fontWeight: '600', fontFamily: F.sb },
    topTitle: { fontSize: 17, fontWeight: '800', color: c.text, fontFamily: F.b },
    save: { fontSize: 16, color: c.primary, fontWeight: '800', fontFamily: F.b },
    container: { padding: 20, paddingBottom: 40, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: c.text, marginTop: 16, marginBottom: 8, fontFamily: F.sb },
    muted: { fontSize: 13, color: c.muted, fontFamily: F.r },
    input: {
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: c.text, fontFamily: F.r,
    },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: c.border, backgroundColor: c.surface, alignItems: 'center',
    },
    typeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    typeChipText: { fontSize: 13, fontWeight: '700', color: c.text, fontFamily: F.b },
    typeChipTextActive: { color: '#fff' },
    chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
    chip: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 14, fontWeight: '600', color: c.text, fontFamily: F.sb },
    chipTextActive: { color: '#fff' },
    amountBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
      borderWidth: 1.5, borderColor: c.border, borderRadius: 16,
      paddingHorizontal: 18, paddingVertical: 10,
    },
    amountPrefix: { fontSize: 22, fontWeight: '800', color: c.muted, marginRight: 8, fontFamily: F.b },
    amountInput: { flex: 1, fontSize: 30, fontWeight: '800', color: c.text, paddingVertical: 6 },
    dateBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    },
    dateText: { fontSize: 15, fontWeight: '600', color: c.text, fontFamily: F.sb },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: c.text, fontFamily: F.sb },
    saveBtn: {
      backgroundColor: c.primary, borderRadius: 14, paddingVertical: 17,
      alignItems: 'center', marginTop: 28,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: F.b },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginTop: 14, paddingVertical: 14,
    },
    deleteBtnText: { color: c.danger, fontSize: 15, fontWeight: '700', fontFamily: F.b },
  });
}
