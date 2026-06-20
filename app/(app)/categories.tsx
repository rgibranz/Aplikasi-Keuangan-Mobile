import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  createCategory,
  deleteCategory,
  getCategories,
  type CategoryType,
} from '../../lib/categories';
import { colors } from '../../lib/theme';
import type { Category } from '../../lib/types';

const EMOJI_PRESETS = [
  '🍔', '🛒', '🚗', '🏠', '💡', '📱', '🎬', '👕', '💊', '🎓',
  '✈️', '🎁', '💼', '📈', '🏥', '⚽', '☕', '🐶', '🧾', '💰',
];
const COLOR_PRESETS = [
  '#059669', '#2563EB', '#DC2626', '#D97706', '#7C3AED',
  '#DB2777', '#0891B2', '#65A30D', '#475569', '#EA580C',
];
const TYPE_LABEL: Record<CategoryType, string> = {
  Income: 'Pemasukan',
  Expense: 'Pengeluaran',
};

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | CategoryType>('All');
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      setCategories(await getCategories());
    } catch (e) {
      Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(cat: Category) {
    Alert.alert(
      'Hapus kategori?',
      `"${cat.category_name}" akan dihapus. Transaksi lama tetap ada, tapi kategorinya jadi kosong.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              load();
            } catch (e) {
              Alert.alert('Gagal hapus', e instanceof Error ? e.message : 'Error');
            }
          },
        },
      ],
    );
  }

  const filtered = categories.filter((c) =>
    filter === 'All' ? true : c.category_type === filter,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Kembali</Text>
        </Pressable>
        <Text style={styles.title}>Kategori</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.filterRow}>
        {(['All', 'Income', 'Expense'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f === 'All' ? 'Semua' : TYPE_LABEL[f]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && categories.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏷️</Text>
              <Text style={styles.emptyTitle}>Belum ada kategori</Text>
              <Text style={styles.emptyText}>
                Tambah kategori untuk mengelompokkan transaksimu.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onLongPress={() => confirmDelete(item)}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.color_hex ?? colors.border },
                ]}
              >
                <Text style={styles.iconEmoji}>{item.icon_name ?? '🏷️'}</Text>
              </View>
              <Text style={styles.cardName}>{item.category_name}</Text>
              <View
                style={[
                  styles.badge,
                  item.category_type === 'Income'
                    ? styles.badgeIncome
                    : styles.badgeExpense,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    item.category_type === 'Income'
                      ? styles.badgeTextIncome
                      : styles.badgeTextExpense,
                  ]}
                >
                  {item.category_type === 'Income' ? 'Masuk' : 'Keluar'}
                </Text>
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            categories.length > 0 ? (
              <Text style={styles.hint}>Tahan kartu untuk menghapus.</Text>
            ) : null
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>＋ Tambah Kategori</Text>
      </Pressable>

      <AddCategoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={() => {
          setModalVisible(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function AddCategoryModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('Expense');
  const [emoji, setEmoji] = useState(EMOJI_PRESETS[0]);
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Lengkapi dulu', 'Nama kategori wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await createCategory({
        category_name: name.trim(),
        category_type: type,
        icon_name: emoji,
        color_hex: color,
      });
      setName('');
      setType('Expense');
      setEmoji(EMOJI_PRESETS[0]);
      setColor(COLOR_PRESETS[0]);
      onCreated();
    } catch (e) {
      Alert.alert('Gagal simpan', e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Kategori Baru</Text>

            <View style={styles.previewRow}>
              <View style={[styles.iconCircle, { backgroundColor: color }]}>
                <Text style={styles.iconEmoji}>{emoji}</Text>
              </View>
              <Text style={styles.previewName}>
                {name.trim() || 'Nama kategori'}
              </Text>
            </View>

            <Text style={styles.label}>Nama</Text>
            <TextInput
              style={styles.input}
              placeholder="cth. Makan, Gaji, Transport"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Tipe</Text>
            <View style={styles.typeRow}>
              {(['Expense', 'Income'] as CategoryType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.typeChip, type === t && styles.typeChipActive]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      type === t && styles.typeChipTextActive,
                    ]}
                  >
                    {TYPE_LABEL[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Ikon</Text>
            <View style={styles.emojiWrap}>
              {EMOJI_PRESETS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[styles.emojiCell, emoji === e && styles.emojiCellActive]}
                >
                  <Text style={styles.emojiCellText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Warna</Text>
            <View style={styles.colorWrap}>
              {COLOR_PRESETS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSave, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text },
  filterTextActive: { color: '#fff' },
  list: { padding: 20, paddingBottom: 120, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 20 },
  cardName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeIncome: { backgroundColor: '#DCFCE7' },
  badgeExpense: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextIncome: { color: '#15803D' },
  badgeTextExpense: { color: '#B91C1C' },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 12 },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  previewName: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  typeChipTextActive: { color: '#fff' },
  emojiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellActive: { borderColor: colors.primary, borderWidth: 2 },
  emojiCellText: { fontSize: 20 },
  colorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  modalCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  modalSave: { backgroundColor: colors.primary },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
