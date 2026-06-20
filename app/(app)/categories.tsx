import { useCallback, useState } from 'react';
import { Feather } from '@expo/vector-icons';
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
import { useThemeColors, type AppColors } from '../../lib/ThemeProvider';
import type { Category } from '../../lib/types';

type TemplateCategory = { name: string; icon: string; color: string; type: CategoryType };

const CATEGORY_TEMPLATES: TemplateCategory[] = [
  { name: 'Makan & Minum', icon: '🍔', color: '#D97706', type: 'Expense' },
  { name: 'Transport',      icon: '🚗', color: '#2563EB', type: 'Expense' },
  { name: 'Belanja',        icon: '🛒', color: '#7C3AED', type: 'Expense' },
  { name: 'Internet',       icon: '🌐', color: '#0891B2', type: 'Expense' },
  { name: 'Keluarga',       icon: '👪', color: '#059669', type: 'Expense' },
  { name: 'Rumah',          icon: '🏠', color: '#EA580C', type: 'Expense' },
  { name: 'Jajan',          icon: '☕', color: '#DB2777', type: 'Expense' },
  { name: 'Sedekah',        icon: '🤲', color: '#059669', type: 'Expense' },
  { name: 'Skin & Body Care', icon: '✨', color: '#DB2777', type: 'Expense' },
  { name: 'Hiburan',        icon: '🎬', color: '#7C3AED', type: 'Expense' },
  { name: 'Hadiah',         icon: '🎁', color: '#EA580C', type: 'Expense' },
  { name: 'Kesehatan',      icon: '💊', color: '#DC2626', type: 'Expense' },
  { name: 'Rokok',          icon: '🚬', color: '#475569', type: 'Expense' },
  { name: 'Lainnya',        icon: '📦', color: '#475569', type: 'Expense' },
];

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
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | CategoryType>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);

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
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Feather name="chevron-left" size={18} color={colors.primary} />
          <Text style={styles.back}>Kembali</Text>
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
              <Feather name="tag" size={48} color={colors.muted} />
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

      <View style={styles.fabRow}>
        <Pressable style={[styles.fab, styles.fabOutline]} onPress={() => setTemplateVisible(true)}>
          <Feather name="list" size={16} color={colors.primary} />
          <Text style={styles.fabOutlineText}>Template</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>＋ Kustom</Text>
        </Pressable>
      </View>

      <AddCategoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={() => {
          setModalVisible(false);
          load();
        }}
      />

      <TemplateModal
        visible={templateVisible}
        onClose={() => setTemplateVisible(false)}
        onAdded={load}
        existingNames={categories.map((c) => c.category_name)}
      />
    </SafeAreaView>
  );
}

function TemplateModal({
  visible,
  onClose,
  onAdded,
  existingNames,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  existingNames: string[];
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [loadingName, setLoadingName] = useState<string | null>(null);

  const existingSet = new Set(existingNames);

  async function handleAdd(t: TemplateCategory) {
    if (loadingName || added.has(t.name) || existingSet.has(t.name)) return;
    setLoadingName(t.name);
    try {
      await createCategory({
        category_name: t.name,
        category_type: t.type,
        icon_name: t.icon,
        color_hex: t.color,
      });
      setAdded((prev) => new Set([...prev, t.name]));
      onAdded();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingName(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.tmplHeader}>
            <Text style={styles.modalTitle}>Pilih Template</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.tmplSubtitle}>Tap untuk langsung menambahkan kategori.</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
            {CATEGORY_TEMPLATES.map((t) => {
              const isDone = existingSet.has(t.name) || added.has(t.name);
              const isLoading = loadingName === t.name;
              return (
                <Pressable
                  key={t.name}
                  style={[styles.tmplRow, isDone && styles.tmplRowDone]}
                  onPress={() => handleAdd(t)}
                  disabled={isDone || !!loadingName}
                >
                  <View style={[styles.tmplIconCircle, { backgroundColor: t.color + '22' }]}>
                    <Text style={styles.tmplIconText}>{t.icon}</Text>
                  </View>
                  <Text
                    style={[styles.tmplRowName, isDone && styles.tmplRowNameDone]}
                    numberOfLines={1}
                  >
                    {t.name}
                  </Text>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : isDone ? (
                    <Feather name="check-circle" size={20} color={colors.primary} />
                  ) : (
                    <Feather name="plus-circle" size={20} color={colors.muted} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={styles.tmplDoneBtn} onPress={onClose}>
            <Text style={styles.tmplDoneBtnText}>Selesai</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  const colors = useThemeColors();
  const styles = getStyles(colors);
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

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    back: { fontSize: 16, color: c.primary, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '800', color: c.text },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterText: { fontSize: 13, fontWeight: '600', color: c.text },
    filterTextActive: { color: '#fff' },
    list: { padding: 20, paddingBottom: 120, gap: 12 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    emptyText: {
      fontSize: 13,
      color: c.muted,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    iconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconEmoji: { fontSize: 20 },
    cardName: { flex: 1, fontSize: 15, fontWeight: '700', color: c.text },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeIncome: { backgroundColor: '#DCFCE7' },
    badgeExpense: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 11, fontWeight: '700' },
    badgeTextIncome: { color: '#15803D' },
    badgeTextExpense: { color: '#B91C1C' },
    hint: { textAlign: 'center', color: c.muted, fontSize: 12, marginTop: 12 },
    fabRow: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 24,
      flexDirection: 'row',
      gap: 10,
    },
    fab: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    fabOutline: {
      flex: 0.75,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    fabOutlineText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalSheet: {
      backgroundColor: c.card,
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
      backgroundColor: c.border,
      marginBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: c.text },
    // Template modal
    tmplHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    tmplSubtitle: { fontSize: 13, color: c.muted },
    tmplRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tmplRowDone: { opacity: 0.5 },
    tmplIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tmplIconText: { fontSize: 20 },
    tmplRowName: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    tmplRowNameDone: { color: c.muted },
    tmplDoneBtn: {
      marginTop: 14,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    tmplDoneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    // Custom category modal
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
    previewName: { fontSize: 16, fontWeight: '700', color: c.text },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
      marginBottom: 6,
      marginTop: 16,
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
    },
    typeRow: { flexDirection: 'row', gap: 10 },
    typeChip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    typeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    typeChipText: { fontSize: 14, fontWeight: '600', color: c.text },
    typeChipTextActive: { color: '#fff' },
    emojiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emojiCell: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiCellActive: { borderColor: c.primary, borderWidth: 2 },
    emojiCellText: { fontSize: 20 },
    colorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    colorDot: { width: 36, height: 36, borderRadius: 18 },
    colorDotActive: { borderWidth: 3, borderColor: c.text },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    modalCancel: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalCancelText: { color: c.text, fontWeight: '700', fontSize: 15 },
    modalSave: { backgroundColor: c.primary },
    modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
