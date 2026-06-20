import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { createWallet, deleteWallet, getWallets } from '../../../lib/wallets';
import { formatRupiah } from '../../../lib/format';
import { colors } from '../../../lib/theme';
import type { Wallet, WalletType } from '../../../lib/types';

const WALLET_TYPES: WalletType[] = ['Bank', 'E-Wallet', 'Cash'];

function emojiFor(type: WalletType): string {
  if (type === 'Bank') return '🏦';
  if (type === 'E-Wallet') return '📱';
  return '💵';
}

export default function WalletsScreen() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      setWallets(await getWallets());
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

  function confirmDelete(wallet: Wallet) {
    Alert.alert(
      'Hapus dompet?',
      `"${wallet.wallet_name}" beserta semua transaksinya akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(wallet.id);
              load();
            } catch (e) {
              Alert.alert('Gagal hapus', e instanceof Error ? e.message : 'Error');
            }
          },
        },
      ],
    );
  }

  const total = wallets.reduce((s, w) => s + Number(w.current_balance), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Dompet</Text>
        <Text style={styles.total}>{formatRupiah(total)}</Text>
      </View>

      {loading && wallets.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={wallets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👛</Text>
              <Text style={styles.emptyTitle}>Belum ada dompet</Text>
              <Text style={styles.emptyText}>
                Tap tombol di bawah untuk menambah dompet pertama kamu.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardEmoji}>{emojiFor(item.wallet_type)}</Text>
                <View>
                  <Text style={styles.cardName}>{item.wallet_name}</Text>
                  <Text style={styles.cardType}>{item.wallet_type}</Text>
                </View>
              </View>
              <Text style={styles.cardBalance}>
                {formatRupiah(Number(item.current_balance))}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            wallets.length > 0 ? (
              <Text style={styles.hint}>Tahan kartu dompet untuk menghapus.</Text>
            ) : null
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>＋ Tambah Dompet</Text>
      </Pressable>

      <AddWalletModal
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

function AddWalletModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('Bank');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Lengkapi dulu', 'Nama dompet wajib diisi.');
      return;
    }
    const parsedBalance = Number(balance.replace(/[^0-9]/g, '')) || 0;
    setSaving(true);
    try {
      await createWallet({
        wallet_name: name.trim(),
        wallet_type: type,
        current_balance: parsedBalance,
      });
      setName('');
      setType('Bank');
      setBalance('');
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
          <Text style={styles.modalTitle}>Dompet Baru</Text>

          <Text style={styles.label}>Nama dompet</Text>
          <TextInput
            style={styles.input}
            placeholder="cth. BCA, GoPay, Dompet"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Jenis</Text>
          <View style={styles.typeRow}>
            {WALLET_TYPES.map((t) => (
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
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Saldo awal (opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            value={balance}
            onChangeText={setBalance}
          />

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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  total: { fontSize: 16, fontWeight: '700', color: colors.primary },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 26 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardType: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardBalance: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    marginTop: 12,
  },
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
    paddingBottom: 32,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: 14,
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
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  typeChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  modalSave: { backgroundColor: colors.primary },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
