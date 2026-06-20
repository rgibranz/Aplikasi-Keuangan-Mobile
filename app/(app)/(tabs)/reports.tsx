import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  type DimensionValue,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getTransactions } from '../../../lib/transactions';
import { getCategories } from '../../../lib/categories';
import { formatRupiah, monthYearLabel } from '../../../lib/format';
import { monthlyTotals, totalsByCategory } from '../../../lib/stats';
import { colors } from '../../../lib/theme';
import type { Category, Transaction } from '../../../lib/types';

type ReportType = 'Expense' | 'Income';

function firstOfThisMonth(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

export default function ReportsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<Date>(firstOfThisMonth);
  const [type, setType] = useState<ReportType>('Expense');

  const load = useCallback(async () => {
    try {
      const [tx, cats] = await Promise.all([getTransactions(), getCategories()]);
      setTransactions(tx);
      setCatMap(Object.fromEntries(cats.map((c) => [c.id, c])));
    } catch {
      // diabaikan; layar tetap menampilkan data kosong
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { income, expense } = useMemo(
    () => monthlyTotals(transactions, ref),
    [transactions, ref],
  );
  const net = income - expense;
  const breakdown = useMemo(
    () => totalsByCategory(transactions, ref, type),
    [transactions, ref, type],
  );
  const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);
  const maxTotal = breakdown.reduce((m, b) => Math.max(m, b.total), 0);

  function changeMonth(delta: number) {
    setRef((r) => new Date(r.getFullYear(), r.getMonth() + delta, 1));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan</Text>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth(-1)} style={styles.navBtn} hitSlop={10}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthText}>{monthYearLabel(ref)}</Text>
        <Pressable onPress={() => changeMonth(1)} style={styles.navBtn} hitSlop={10}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      {loading && transactions.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryCaption}>Pemasukan</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  {formatRupiah(income)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryCaption}>Pengeluaran</Text>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  {formatRupiah(expense)}
                </Text>
              </View>
            </View>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Selisih</Text>
              <Text
                style={[
                  styles.netValue,
                  { color: net >= 0 ? colors.primary : colors.danger },
                ]}
              >
                {formatRupiah(net)}
              </Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            {(['Expense', 'Income'] as ReportType[]).map((tp) => (
              <Pressable
                key={tp}
                onPress={() => setType(tp)}
                style={[styles.toggleChip, type === tp && styles.toggleChipActive]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    type === tp && styles.toggleTextActive,
                  ]}
                >
                  {tp === 'Expense' ? 'Pengeluaran' : 'Pemasukan'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Per kategori</Text>

          {breakdown.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>
                Belum ada {type === 'Expense' ? 'pengeluaran' : 'pemasukan'} di
                bulan ini.
              </Text>
            </View>
          ) : (
            breakdown.map((b) => {
              const cat = b.categoryId ? catMap[b.categoryId] : null;
              const pct = grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0;
              const barWidth = (maxTotal > 0 ? (b.total / maxTotal) * 100 : 0) as number;
              const color = cat?.color_hex ?? colors.muted;
              return (
                <View key={b.categoryId ?? 'none'} style={styles.catRow}>
                  <View style={styles.catTop}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {`${cat?.icon_name ?? '🏷️'} ${cat?.category_name ?? 'Tanpa kategori'}`}
                    </Text>
                    <Text style={styles.catAmount}>{formatRupiah(b.total)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${barWidth}%` as DimensionValue,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.catPct}>{pct}% dari total</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navArrow: { fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 26 },
  monthText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    minWidth: 130,
    textAlign: 'center',
  },
  container: { padding: 20, paddingBottom: 40, gap: 16 },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, alignItems: 'center', gap: 4 },
  summaryCaption: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  summaryValue: { fontSize: 17, fontWeight: '800' },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  netLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  netValue: { fontSize: 18, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  toggleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontSize: 14, fontWeight: '700', color: colors.text },
  toggleTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  catRow: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  catTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  catName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  catAmount: { fontSize: 14, fontWeight: '800', color: colors.text },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  catPct: { fontSize: 11, color: colors.muted, fontWeight: '600' },
});
