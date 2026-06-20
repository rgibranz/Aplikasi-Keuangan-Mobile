import { useCallback, useState } from 'react';
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
import { deleteTransaction, getTransactions } from '../../../lib/transactions';
import { getWallets } from '../../../lib/wallets';
import { getCategories } from '../../../lib/categories';
import { formatDateGroup, formatRupiah } from '../../../lib/format';
import { colors } from '../../../lib/theme';
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

  function confirmDelete(t: Transaction) {
    Alert.alert(
      'Hapus transaksi?',
      'Saldo dompet akan disesuaikan otomatis.',
      [
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
      ],
    );
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
              <Text style={styles.emptyEmoji}>💸</Text>
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
              <TransactionRow
                t={item.tx}
                walletMap={walletMap}
                catMap={catMap}
                onEdit={() =>
                  router.push({
                    pathname: '/transaction-form',
                    params: { id: item.tx.id },
                  })
                }
                onDelete={() => confirmDelete(item.tx)}
              />
            )
          }
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/transaction-form')}
      >
        <Text style={styles.fabText}>＋ Catat Transaksi</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function TransactionRow({
  t,
  walletMap,
  catMap,
  onEdit,
  onDelete,
}: {
  t: Transaction;
  walletMap: Record<string, Wallet>;
  catMap: Record<string, Category>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = t.transaction_type === 'Income';
  const isTransfer = t.transaction_type === 'Transfer';
  const cat = t.category_id ? catMap[t.category_id] : null;
  const wallet = walletMap[t.wallet_id];
  const dest = t.destination_wallet_id ? walletMap[t.destination_wallet_id] : null;

  const emoji = isTransfer ? '🔁' : cat?.icon_name ?? (isIncome ? '💰' : '🧾');
  const tint = isTransfer
    ? colors.muted
    : cat?.color_hex ?? (isIncome ? colors.primary : colors.danger);
  const title = isTransfer
    ? 'Transfer'
    : cat?.category_name ?? (isIncome ? 'Pemasukan' : 'Pengeluaran');
  const subtitle = isTransfer
    ? `${wallet?.wallet_name ?? '?'} → ${dest?.wallet_name ?? '?'}`
    : wallet?.wallet_name ?? '';
  const sign = isIncome ? '+' : isTransfer ? '' : '-';
  const amountColor = isIncome
    ? colors.primary
    : isTransfer
      ? colors.text
      : colors.danger;

  return (
    <Pressable style={styles.row} onPress={onEdit} onLongPress={onDelete}>
      <View style={[styles.rowIcon, { backgroundColor: tint + '22' }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
          {t.notes ? ` · ${t.notes}` : ''}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: amountColor }]}>
        {sign}
        {formatRupiah(Number(t.amount))}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text },
  filterTextActive: { color: '#fff' },
  list: { padding: 20, paddingBottom: 120, gap: 10 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 10,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '800' },
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
});
