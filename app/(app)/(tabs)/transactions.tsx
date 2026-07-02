import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { deleteTransaction, getTransactions } from '../../../lib/transactions';
import { getWallets } from '../../../lib/wallets';
import { getCategories } from '../../../lib/categories';
import { formatDateGroup } from '../../../lib/format';
import { useThemeColors, type AppColors, F } from '../../../lib/ThemeProvider';
import { onSynced } from '../../../lib/sync';
import { TransactionItem } from '../../../components/TransactionItem';
import type { Category, Transaction, Wallet } from '../../../lib/types';

type Filter = 'All' | 'Income' | 'Expense' | 'Transfer';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'All', label: 'Semua' },
  { value: 'Income', label: 'Masuk' },
  { value: 'Expense', label: 'Keluar' },
  { value: 'Transfer', label: 'Transfer' },
];

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

export default function TransactionsScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletMap, setWalletMap] = useState<Record<string, Wallet>>({});
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('All');

  const load = useCallback(async () => {
    try {
      const [tx, wallets, cats] = await Promise.all([
        getTransactions(),
        getWallets(),
        getCategories(),
      ]);
      setTransactions(tx);
      setWalletMap(Object.fromEntries(wallets.map((w) => [w.id, w])));
      setCatMap(Object.fromEntries(cats.map((c) => [c.id, c])));
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

  const filtered = transactions.filter((t) =>
    filter === 'All' ? true : t.transaction_type === filter,
  );
  const rows = buildRows(filtered);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaksi</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.scrollArea}>
        {loading && transactions.length === 0 ? (
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
                Tap tombol di bawah untuk mencatat transaksi pertama kamu.
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
                  router.push({
                    pathname: '/transaction-form',
                    params: { id: item.tx.id },
                  })
                }
                onLongPress={() => confirmDelete(item.tx)}
              />
            )
          }
        />
        )}
      </View>

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/transaction-form')}
      >
        <Text style={styles.fabText}>＋ Catat Transaksi</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scrollArea: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
    title: { fontSize: 26, fontWeight: '800', color: c.text, fontFamily: F.b },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterText: { fontSize: 13, fontWeight: '600', color: c.text, fontFamily: F.sb },
    filterTextActive: { color: '#fff', fontFamily: F.sb },
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
  });
}
