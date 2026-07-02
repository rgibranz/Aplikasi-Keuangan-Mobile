import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { deleteTransaction, getTransactions, reconcileWallet } from '../../lib/transactions';
import { getWallets, updateWallet } from '../../lib/wallets';
import { getCategories } from '../../lib/categories';
import { formatRupiah, formatDateGroup } from '../../lib/format';
import { useThemeColors, type AppColors, F } from '../../lib/ThemeProvider';
import { onSynced } from '../../lib/sync';
import { TransactionItem } from '../../components/TransactionItem';
import type { Category, Transaction, Wallet } from '../../lib/types';

function iconFor(type: string): React.ComponentProps<typeof Feather>['name'] {
  if (type === 'Bank') return 'credit-card';
  if (type === 'E-Wallet') return 'smartphone';
  return 'dollar-sign';
}

function colorFor(type: string): string {
  if (type === 'Bank') return '#2563EB';
  if (type === 'E-Wallet') return '#7C3AED';
  return '#15803D';
}

type Row =
  | { key: string; kind: 'header'; label: string }
  | { key: string; kind: 'item'; tx: Transaction };

function buildRows(txs: Transaction[]): Row[] {
  const rows: Row[] = [];
  let lastGroup = '';
  for (const t of txs) {
    const g = formatDateGroup(t.transaction_date);
    if (g !== lastGroup) {
      rows.push({ key: `h-${t.id}`, kind: 'header', label: g });
      lastGroup = g;
    }
    rows.push({ key: t.id, kind: 'item', tx: t });
  }
  return rows;
}

export default function WalletDetailScreen() {
  const { id, name, type, balance } = useLocalSearchParams<{
    id: string; name: string; type: string; balance: string;
  }>();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletMap, setWalletMap] = useState<Record<string, Wallet>>({});
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);

  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileInput, setReconcileInput] = useState('');
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [txAll, wallets, cats] = await Promise.all([
        getTransactions(),
        getWallets(),
        getCategories(),
      ]);
      setTransactions(
        txAll.filter((t) => t.wallet_id === id || t.destination_wallet_id === id),
      );
      setWalletMap(Object.fromEntries(wallets.map((w) => [w.id, w])));
      setCatMap(Object.fromEntries(cats.map((c) => [c.id, c])));
    } catch (e) {
      Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onSynced(load), [load]);

  function confirmDelete(t: Transaction) {
    Alert.alert('Hapus transaksi?', 'Saldo dompet akan disesuaikan otomatis.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(t.id);
            load();
          } catch (e) {
            Alert.alert('Gagal hapus', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  function openReconcile() {
    const current = walletMap[id]?.current_balance ?? Number(balance ?? 0);
    setReconcileInput(String(Math.round(current)));
    setReconcileOpen(true);
  }

  async function submitReconcile() {
    const cleaned = reconcileInput.trim();
    const digits = cleaned.replace(/[^0-9]/g, '');
    if (digits === '') {
      Alert.alert('Angka tidak valid', 'Masukkan saldo dompet yang sebenarnya.');
      return;
    }
    const actual = cleaned.startsWith('-') ? -Number(digits) : Number(digits);
    setReconciling(true);
    try {
      const res = await reconcileWallet(id, actual);
      setReconcileOpen(false);
      await load();
      if (!res.adjusted) {
        Alert.alert('Sudah cocok', 'Saldo sudah sesuai, tidak ada yang diubah.');
      } else {
        const sign = res.type === 'Income' ? '+' : '−';
        const label = res.type === 'Income' ? 'pemasukan' : 'pengeluaran';
        Alert.alert(
          'Saldo disesuaikan',
          `${sign}${formatRupiah(res.amount)} dicatat sebagai ${label}.`,
        );
      }
    } catch (e) {
      Alert.alert('Gagal menyesuaikan', e instanceof Error ? e.message : 'Error');
    } finally {
      setReconciling(false);
    }
  }

  async function toggleExclude(value: boolean) {
    try {
      await updateWallet(id, { exclude_from_total: value });
      load();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Error');
    }
  }

  const typeColor = colorFor(type ?? '');
  const rows = buildRows(transactions);
  const excluded = walletMap[id]?.exclude_from_total ?? false;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Hero */}
      <View style={styles.heroSection}>
        <View style={[styles.hero, { borderColor: typeColor + '40' }]}>
          <View style={[styles.heroIcon, { backgroundColor: typeColor + '18' }]}>
            <Feather name={iconFor(type ?? '')} size={26} color={typeColor} />
          </View>
          <View style={{ gap: 3 }}>
            <Text style={styles.heroType}>{type}</Text>
            <Text style={styles.heroBalance}>{formatRupiah(Number(balance ?? 0))}</Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Hitung ke total saldo</Text>
            <Text style={styles.toggleHint}>
              {excluded ? 'Saat ini tidak masuk total.' : 'Saat ini masuk total.'}
            </Text>
          </View>
          <Switch
            value={!excluded}
            onValueChange={(v) => toggleExclude(!v)}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <Pressable style={styles.reconcileBtn} onPress={openReconcile}>
          <Feather name="sliders" size={16} color={colors.primary} />
          <Text style={styles.reconcileBtnText}>Sesuaikan saldo</Text>
        </Pressable>
      </View>

      {/* Transaction list */}
      <View style={styles.scrollArea}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={styles.list}
            onRefresh={load}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="inbox" size={44} color={colors.muted} />
                <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
                <Text style={styles.emptyText}>
                  Transaksi di dompet ini akan muncul di sini.
                </Text>
              </View>
            }
            renderItem={({ item }) =>
              item.kind === 'header' ? (
                <Text style={styles.groupHeader}>{item.label}</Text>
              ) : (
                <TransactionItem
                  t={item.tx}
                  walletMap={walletMap}
                  catMap={catMap}
                  onPress={() =>
                    router.push({ pathname: '/transaction-form', params: { id: item.tx.id } })
                  }
                  onLongPress={() => confirmDelete(item.tx)}
                />
              )
            }
          />
        )}
      </View>

      <Modal
        visible={reconcileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReconcileOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sesuaikan saldo</Text>
            <Text style={styles.modalHint}>
              Berapa saldo {name} yang sebenarnya sekarang?
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reconcileInput}
              onChangeText={setReconcileInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setReconcileOpen(false)}
                disabled={reconciling}
              >
                <Text style={styles.modalBtnGhostText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitReconcile}
                disabled={reconciling}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {reconciling ? 'Menyimpan…' : 'Sesuaikan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scrollArea: { flex: 1, backgroundColor: c.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      gap: 8,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      fontFamily: F.b,
    },

    heroSection: { paddingHorizontal: 20, paddingBottom: 12 },
    hero: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroType: { fontSize: 13, color: c.muted, fontFamily: F.r },
    heroBalance: { fontSize: 24, fontWeight: '800', color: c.text, fontFamily: F.b },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginTop: 10,
    },
    toggleLabel: { fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    toggleHint: { fontSize: 12, color: c.muted, marginTop: 2, fontFamily: F.r },

    list: { padding: 20, paddingBottom: 40, gap: 10 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, fontFamily: F.b },
    emptyText: {
      fontSize: 13,
      color: c.muted,
      textAlign: 'center',
      paddingHorizontal: 40,
      fontFamily: F.r,
    },
    groupHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: c.muted,
      marginTop: 12,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: F.b,
    },

    reconcileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginTop: 10,
    },
    reconcileBtnText: { fontSize: 14, fontWeight: '700', color: c.primary, fontFamily: F.b },

    modalBackdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 10,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: c.text, fontFamily: F.b },
    modalHint: { fontSize: 13, color: c.muted, fontFamily: F.r },
    modalInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      color: c.text,
      fontFamily: F.b,
      marginTop: 4,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalBtnGhost: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
    modalBtnGhostText: { fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    modalBtnPrimary: { backgroundColor: c.primary },
    modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: F.b },
  });
}
