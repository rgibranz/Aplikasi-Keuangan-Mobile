import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getWallets } from '../../../lib/wallets';
import { getCategories } from '../../../lib/categories';
import { getTransactions } from '../../../lib/transactions';
import { formatRupiah, monthYearLabel } from '../../../lib/format';
import { monthlyTotals } from '../../../lib/stats';
import { colors } from '../../../lib/theme';
import { TransactionItem } from '../../../components/TransactionItem';
import type { Category, Transaction, Wallet } from '../../../lib/types';

export default function Home() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletMap, setWalletMap] = useState<Record<string, Wallet>>({});
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [w, tx, cats] = await Promise.all([
        getWallets(),
        getTransactions(),
        getCategories(),
      ]);
      setWallets(w);
      setTransactions(tx);
      setWalletMap(Object.fromEntries(w.map((x) => [x.id, x])));
      setCatMap(Object.fromEntries(cats.map((c) => [c.id, c])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const total = wallets.reduce((sum, w) => sum + Number(w.current_balance), 0);
  const now = new Date();
  const { income, expense } = monthlyTotals(transactions, now);
  const recent = transactions.slice(0, 5);
  const email = session?.user.email ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.hi}>Halo,</Text>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOut}>
            <Text style={styles.signOutText}>Keluar</Text>
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Saldo</Text>
          <Text style={styles.balanceValue}>{formatRupiah(total)}</Text>
          <Text style={styles.balanceHint}>
            {wallets.length === 0 ? 'Belum ada dompet' : `${wallets.length} dompet`}
          </Text>
        </View>

        <View style={styles.monthCard}>
          <Text style={styles.monthLabel}>{monthYearLabel(now)}</Text>
          <View style={styles.monthRow}>
            <View style={styles.monthCol}>
              <Text style={styles.monthCaption}>Pemasukan</Text>
              <Text style={[styles.monthValue, { color: colors.primary }]}>
                {formatRupiah(income)}
              </Text>
            </View>
            <View style={styles.monthDivider} />
            <View style={styles.monthCol}>
              <Text style={styles.monthCaption}>Pengeluaran</Text>
              <Text style={[styles.monthValue, { color: colors.danger }]}>
                {formatRupiah(expense)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/transaction-form')}
          >
            <Text style={styles.quickEmoji}>➕</Text>
            <Text style={styles.quickText}>Catat</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/categories')}
          >
            <Text style={styles.quickEmoji}>🏷️</Text>
            <Text style={styles.quickText}>Kategori</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/wallets')}
          >
            <Text style={styles.quickEmoji}>👛</Text>
            <Text style={styles.quickText}>Dompet</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Transaksi terbaru</Text>
          <Pressable onPress={() => router.push('/transactions')}>
            <Text style={styles.link}>Lihat semua</Text>
          </Pressable>
        </View>

        {loading && transactions.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
        ) : recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
            <Text style={styles.emptyText}>
              Mulai catat pemasukan & pengeluaranmu.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push('/transaction-form')}
            >
              <Text style={styles.emptyBtnText}>Catat Transaksi</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recent.map((t) => (
              <TransactionItem
                key={t.id}
                t={t}
                walletMap={walletMap}
                catMap={catMap}
                onPress={() =>
                  router.push({
                    pathname: '/transaction-form',
                    params: { id: t.id },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  headerText: { flex: 1, marginRight: 12 },
  hi: { fontSize: 14, color: colors.muted },
  email: { fontSize: 18, fontWeight: '700', color: colors.text },
  signOut: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  signOutText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 24 },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 8 },
  balanceHint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  monthCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 14,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthCol: { flex: 1, alignItems: 'center', gap: 4 },
  monthCaption: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  monthValue: { fontSize: 18, fontWeight: '800' },
  monthDivider: { width: 1, height: 36, backgroundColor: colors.border },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickEmoji: { fontSize: 22 },
  quickText: { fontSize: 12, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  recentList: { gap: 10 },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
