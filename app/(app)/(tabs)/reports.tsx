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
import { Feather } from '@expo/vector-icons';
import { getTransactions } from '../../../lib/transactions';
import { getCategories } from '../../../lib/categories';
import { formatRupiah, monthYearLabel } from '../../../lib/format';
import { monthlyTotals, totalsByCategory } from '../../../lib/stats';
import { useThemeColors, type AppColors, F } from '../../../lib/ThemeProvider';
import type { Category, Transaction } from '../../../lib/types';

type ReportType = 'Expense' | 'Income';

function firstOfThisMonth(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

export default function ReportsScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
      // diabaikan
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
          <Feather name="chevron-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.monthText}>{monthYearLabel(ref)}</Text>
        <Pressable onPress={() => changeMonth(1)} style={styles.navBtn} hitSlop={10}>
          <Feather name="chevron-right" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.scrollArea}>
        {loading && transactions.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryCaption}>Pemasukan</Text>
                <Text style={[styles.summaryValue, { color: colors.income }]}>
                  +{formatRupiah(income)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryCaption}>Pengeluaran</Text>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  -{formatRupiah(expense)}
                </Text>
              </View>
            </View>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Selisih bulan ini</Text>
              <Text
                style={[
                  styles.netValue,
                  { color: net >= 0 ? colors.income : colors.danger },
                ]}
              >
                {net >= 0 ? '+' : ''}{formatRupiah(net)}
              </Text>
            </View>
          </View>

          {/* Toggle */}
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
              <Feather name="bar-chart-2" size={44} color={colors.muted} />
              <Text style={styles.emptyText}>
                Belum ada {type === 'Expense' ? 'pengeluaran' : 'pemasukan'} di bulan ini.
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
                    <View style={styles.catRight}>
                      <Text style={styles.catPct}>{pct}%</Text>
                      <Text style={styles.catAmount}>{formatRupiah(b.total)}</Text>
                    </View>
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
                </View>
              );
            })
          )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scrollArea: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
    title: { fontSize: 26, fontWeight: '800', color: c.text, fontFamily: F.b },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      paddingVertical: 10,
    },
    navBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    monthText: {
      fontSize: 15,
      fontWeight: '800',
      color: c.text,
      minWidth: 130,
      textAlign: 'center',
      fontFamily: F.b,
    },
    container: { padding: 20, paddingBottom: 40, gap: 14 },
    summaryCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryCol: { flex: 1, alignItems: 'center', gap: 5 },
    summaryCaption: { fontSize: 11, color: c.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: F.b },
    summaryValue: { fontSize: 17, fontWeight: '800', fontFamily: F.b },
    summaryDivider: { width: 1, height: 36, backgroundColor: c.border },
    netRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    netLabel: { fontSize: 13, fontWeight: '600', color: c.muted, fontFamily: F.sb },
    netValue: { fontSize: 17, fontWeight: '800', fontFamily: F.b },
    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleChip: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    toggleChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    toggleText: { fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    toggleTextActive: { color: '#fff', fontFamily: F.b },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: c.text, fontFamily: F.b },
    empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyText: {
      fontSize: 13,
      color: c.muted,
      textAlign: 'center',
      paddingHorizontal: 30,
      fontFamily: F.r,
    },
    catRow: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    catTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    catName: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    catRight: { alignItems: 'flex-end', gap: 2 },
    catPct: { fontSize: 11, color: c.muted, fontWeight: '600', fontFamily: F.sb },
    catAmount: { fontSize: 14, fontWeight: '800', color: c.text, fontFamily: F.b },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    barFill: { height: 6, borderRadius: 3 },
  });
}
