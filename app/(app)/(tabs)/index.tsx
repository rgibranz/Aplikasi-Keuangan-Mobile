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
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth';
import { getWallets } from '../../../lib/wallets';
import { getCategories } from '../../../lib/categories';
import { getTransactions } from '../../../lib/transactions';
import { formatRupiah, monthYearLabel } from '../../../lib/format';
import { monthlyTotals } from '../../../lib/stats';
import { useThemeColors, type AppColors, F, useBalanceVisible } from '../../../lib/ThemeProvider';
import { useRefreshOnSync } from '../../../lib/sync';
import { TransactionItem } from '../../../components/TransactionItem';
import type { Category, Transaction, Wallet } from '../../../lib/types';

export default function Home() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const { balanceVisible, toggleBalanceVisible } = useBalanceVisible();
  const styles = getStyles(colors);
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
  useRefreshOnSync(load);

  const total = wallets
    .filter((w) => !w.exclude_from_total)
    .reduce((sum, w) => sum + Number(w.current_balance), 0);
  const now = new Date();
  const { income, expense } = monthlyTotals(transactions, now);
  const recent = transactions.slice(0, 5);
  const email = session?.user.email ?? '';
  const firstName = email ? email.split('@')[0] : 'Tamu';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Halo, {firstName} 👋</Text>
          <Text style={styles.date}>{monthYearLabel(now)}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={toggleBalanceVisible} style={styles.iconBtn}>
            <Feather name={balanceVisible ? 'eye' : 'eye-off'} size={16} color={colors.muted} />
          </Pressable>
          <Pressable onPress={signOut} style={styles.iconBtn}>
            <Feather name="log-out" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {/* Balance Hero Card */}
        <Pressable style={styles.balanceCard} onPress={() => router.push('/wallets')}>
          <View style={styles.balanceDecorL} />
          <View style={styles.balanceDecorR} />
          <Text style={styles.balanceLabel}>Total Saldo</Text>
          <Text style={styles.balanceValue}>
            {balanceVisible ? formatRupiah(total) : '••••••'}
          </Text>
          <Text style={styles.balanceHint}>
            {wallets.length === 0 ? 'Belum ada dompet' : `dari ${wallets.length} dompet`}
          </Text>
        </Pressable>

        {/* Monthly Summary */}
        <View style={styles.monthCard}>
          <View style={styles.monthCol}>
            <Text style={styles.monthCaption}>Pemasukan</Text>
            <Text style={[styles.monthValue, { color: colors.income }]}>
              +{formatRupiah(income)}
            </Text>
          </View>
          <View style={styles.monthDivider} />
          <View style={styles.monthCol}>
            <Text style={styles.monthCaption}>Pengeluaran</Text>
            <Text style={[styles.monthValue, { color: colors.danger }]}>
              -{formatRupiah(expense)}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/transaction-form')}
          >
            <View style={styles.quickIcon}>
              <Feather name="plus" size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickText}>Catat</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/categories')}
          >
            <View style={styles.quickIcon}>
              <Feather name="tag" size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickText}>Kategori</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/wallets')}
          >
            <View style={styles.quickIcon}>
              <Feather name="briefcase" size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickText}>Dompet</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Recent Transactions */}
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
            <Feather name="inbox" size={32} color={colors.muted} />
            <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
            <Text style={styles.emptyText}>
              Mulai catat pemasukan & pengeluaranmu.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push('/transaction-form')}
            >
              <Text style={styles.emptyBtnText}>Catat Sekarang</Text>
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

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scrollView: { flex: 1, backgroundColor: c.background },
    container: { padding: 20, gap: 14 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    greeting: { fontSize: 20, fontWeight: '800', color: c.text, fontFamily: F.b },
    date: { fontSize: 13, color: c.muted, marginTop: 2, fontFamily: F.r },
    headerActions: { flexDirection: 'row', gap: 8 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    balanceCard: {
      backgroundColor: c.primary,
      borderRadius: 22,
      padding: 26,
      overflow: 'hidden',
      position: 'relative',
    },
    balanceDecorL: {
      position: 'absolute',
      top: -40,
      left: -40,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    balanceDecorR: {
      position: 'absolute',
      bottom: -30,
      right: -20,
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', fontFamily: F.sb },
    balanceValue: {
      color: '#fff',
      fontSize: 36,
      fontWeight: '800',
      marginTop: 8,
      letterSpacing: -0.5,
      fontFamily: F.b,
    },
    balanceHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, fontFamily: F.r },

    monthCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    monthCol: { flex: 1, alignItems: 'center', gap: 5 },
    monthCaption: { fontSize: 12, color: c.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: F.sb },
    monthValue: { fontSize: 17, fontWeight: '800', fontFamily: F.b },
    monthDivider: { width: 1, height: 36, backgroundColor: c.border },

    quickRow: { flexDirection: 'row', gap: 10 },
    quickCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 8,
    },
    quickIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickText: { fontSize: 12, fontWeight: '700', color: c.text, fontFamily: F.b },

    error: { color: c.danger, fontSize: 13, fontFamily: F.r },

    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: c.text, fontFamily: F.b },
    link: { fontSize: 13, fontWeight: '700', color: c.primary, fontFamily: F.b },

    recentList: { gap: 10 },

    emptyCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 4, fontFamily: F.b },
    emptyText: { fontSize: 13, color: c.muted, textAlign: 'center', fontFamily: F.r },
    emptyBtn: {
      marginTop: 6,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 11,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: F.b },
  });
}
