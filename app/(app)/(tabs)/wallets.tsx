import React, { useCallback, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { createWallet, deleteWallet, getWallets } from '../../../lib/wallets';
import { formatRupiah } from '../../../lib/format';
import { useThemeColors, type AppColors, F } from '../../../lib/ThemeProvider';
import type { Wallet, WalletType } from '../../../lib/types';

const WALLET_TYPES: WalletType[] = ['Bank', 'E-Wallet', 'Cash'];

function iconFor(type: WalletType): React.ComponentProps<typeof Feather>['name'] {
  if (type === 'Bank') return 'credit-card';
  if (type === 'E-Wallet') return 'smartphone';
  return 'dollar-sign';
}

function colorFor(type: WalletType): string {
  if (type === 'Bank') return '#2563EB';
  if (type === 'E-Wallet') return '#7C3AED';
  return '#15803D';
}

export default function WalletsScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
        <View>
          <Text style={styles.title}>Dompet</Text>
          <Text style={styles.totalLabel}>Total saldo</Text>
        </View>
        <Text style={styles.total}>{formatRupiah(total)}</Text>
      </View>

      <View style={styles.scrollArea}>
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
              <Feather name="briefcase" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>Belum ada dompet</Text>
              <Text style={styles.emptyText}>
                Tap tombol di bawah untuk menambah dompet pertama kamu.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const ic = colorFor(item.wallet_type);
            return (
              <Pressable
                style={styles.card}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={[styles.cardIconWrap, { backgroundColor: ic + '18' }]}>
                  <Feather name={iconFor(item.wallet_type)} size={20} color={ic} />
                </View>
                <View style={styles.cardMid}>
                  <Text style={styles.cardName}>{item.wallet_name}</Text>
                  <Text style={styles.cardType}>{item.wallet_type}</Text>
                </View>
                <Text style={styles.cardBalance}>
                  {formatRupiah(Number(item.current_balance))}
                </Text>
              </Pressable>
            );
          }}
          ListFooterComponent={
            wallets.length > 0 ? (
              <Text style={styles.hint}>Tahan kartu dompet untuk menghapus.</Text>
            ) : null
          }
        />
        )}
      </View>

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
  const colors = useThemeColors();
  const styles = getStyles(colors);
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

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scrollArea: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
    },
    title: { fontSize: 26, fontWeight: '800', color: c.text, fontFamily: F.b },
    totalLabel: { fontSize: 12, color: c.muted, marginTop: 2, fontFamily: F.r },
    total: { fontSize: 18, fontWeight: '800', color: c.primary, fontFamily: F.b },
    list: { padding: 20, paddingBottom: 120, gap: 10 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, fontFamily: F.b },
    emptyText: {
      fontSize: 13,
      color: c.muted,
      textAlign: 'center',
      paddingHorizontal: 40,
      fontFamily: F.r,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardMid: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '700', color: c.text, fontFamily: F.b },
    cardType: { fontSize: 12, color: c.muted, marginTop: 2, fontFamily: F.r },
    cardBalance: { fontSize: 15, fontWeight: '800', color: c.text, fontFamily: F.b },
    hint: { textAlign: 'center', color: c.muted, fontSize: 12, marginTop: 14, fontFamily: F.r },
    fab: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 24,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: c.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    fabText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: F.b },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 36,
    },
    modalHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 18,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 6, fontFamily: F.b },
    label: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6, marginTop: 16, fontFamily: F.sb },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
      fontFamily: F.r,
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
    typeChipText: { fontSize: 14, fontWeight: '600', color: c.text, fontFamily: F.sb },
    typeChipTextActive: { color: '#fff', fontFamily: F.sb },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 26 },
    modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    modalCancel: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    modalCancelText: { color: c.text, fontWeight: '700', fontSize: 15, fontFamily: F.b },
    modalSave: { backgroundColor: c.primary },
    modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: F.b },
  });
}
