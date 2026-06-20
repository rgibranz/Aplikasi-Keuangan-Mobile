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
import { formatRupiah } from '../../../lib/format';
import {
  weekStart,
  weekChartData,
  monthChartData,
  yearChartData,
  periodTotals,
  totalsByCategoryRange,
  type BarPoint,
} from '../../../lib/stats';
import { useThemeColors, type AppColors, F } from '../../../lib/ThemeProvider';
import type { Category, Transaction } from '../../../lib/types';

type PeriodMode = 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan';
type ReportType = 'Expense' | 'Income';

const PERIODS: PeriodMode[] = ['Harian', 'Mingguan', 'Bulanan', 'Tahunan'];

const ID_MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];
const ID_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const ID_DAYS_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function getPeriodLabel(mode: PeriodMode, ref: Date): string {
  switch (mode) {
    case 'Harian': {
      const d = ID_DAYS_SHORT[ref.getDay()];
      return `${d}, ${ref.getDate()} ${ID_MONTHS_SHORT[ref.getMonth()]} ${ref.getFullYear()}`;
    }
    case 'Mingguan': {
      const ws = weekStart(ref);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()}–${we.getDate()} ${ID_MONTHS_SHORT[ws.getMonth()]} ${ws.getFullYear()}`;
      }
      return `${ws.getDate()} ${ID_MONTHS_SHORT[ws.getMonth()]}–${we.getDate()} ${ID_MONTHS_SHORT[we.getMonth()]} ${we.getFullYear()}`;
    }
    case 'Bulanan':
      return `${ID_MONTHS[ref.getMonth()]} ${ref.getFullYear()}`;
    case 'Tahunan':
      return `${ref.getFullYear()}`;
  }
}

function stepRef(mode: PeriodMode, ref: Date, delta: number): Date {
  const d = new Date(ref);
  switch (mode) {
    case 'Harian': d.setDate(d.getDate() + delta); break;
    case 'Mingguan': d.setDate(d.getDate() + delta * 7); break;
    case 'Bulanan': d.setMonth(d.getMonth() + delta); break;
    case 'Tahunan': d.setFullYear(d.getFullYear() + delta); break;
  }
  return d;
}

function getPeriodBounds(mode: PeriodMode, ref: Date): { from: Date; to: Date } {
  switch (mode) {
    case 'Harian': {
      const from = new Date(ref); from.setHours(0, 0, 0, 0);
      const to = new Date(ref); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case 'Mingguan': {
      const from = weekStart(ref);
      const to = new Date(from); to.setDate(to.getDate() + 6);
      return { from, to };
    }
    case 'Bulanan': {
      const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return { from, to };
    }
    case 'Tahunan': {
      const from = new Date(ref.getFullYear(), 0, 1);
      const to = new Date(ref.getFullYear(), 11, 31);
      return { from, to };
    }
  }
}

function getChartData(mode: PeriodMode, txs: Transaction[], ref: Date): BarPoint[] {
  switch (mode) {
    case 'Harian':
    case 'Mingguan':
      return weekChartData(txs, weekStart(ref));
    case 'Bulanan':
      return monthChartData(txs, ref);
    case 'Tahunan':
      return yearChartData(txs, ref.getFullYear());
  }
}

export default function ReportsScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PeriodMode>('Bulanan');
  const [ref, setRef] = useState<Date>(() => {
    const n = new Date(); n.setHours(0, 0, 0, 0); return n;
  });
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { from, to } = useMemo(() => getPeriodBounds(mode, ref), [mode, ref]);
  const { income, expense } = useMemo(
    () => periodTotals(transactions, from, to),
    [transactions, from, to],
  );
  const net = income - expense;
  const chartData = useMemo(
    () => getChartData(mode, transactions, ref),
    [mode, transactions, ref],
  );
  const breakdown = useMemo(
    () => totalsByCategoryRange(transactions, from, to, type),
    [transactions, from, to, type],
  );
  const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);
  const maxTotal = breakdown.reduce((m, b) => Math.max(m, b.total), 0);

  function changeRef(delta: number) {
    setRef((r) => stepRef(mode, r, delta));
  }

  function handleModeChange(newMode: PeriodMode) {
    setMode(newMode);
    const n = new Date(); n.setHours(0, 0, 0, 0);
    setRef(n);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Laporan</Text>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => handleModeChange(p)}
            style={[styles.periodChip, mode === p && styles.periodChipActive]}
          >
            <Text style={[styles.periodText, mode === p && styles.periodTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      {/* Period navigation */}
      <View style={styles.navRow}>
        <Pressable onPress={() => changeRef(-1)} style={styles.navBtn} hitSlop={10}>
          <Feather name="chevron-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navLabel} numberOfLines={1}>{getPeriodLabel(mode, ref)}</Text>
        <Pressable onPress={() => changeRef(1)} style={styles.navBtn} hitSlop={10}>
          <Feather name="chevron-right" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.scrollArea}>
        {loading && transactions.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
            {/* Bar Chart */}
            <View style={styles.card}>
              <BarChart
                data={chartData}
                incomeColor={colors.income}
                expenseColor={colors.danger}
                mutedColor={colors.muted}
              />
            </View>

            {/* Summary */}
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
                <Text style={styles.netLabel}>Selisih</Text>
                <Text style={[styles.netValue, { color: net >= 0 ? colors.income : colors.danger }]}>
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
                  <Text style={[styles.toggleText, type === tp && styles.toggleTextActive]}>
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
                  Belum ada {type === 'Expense' ? 'pengeluaran' : 'pemasukan'} di periode ini.
                </Text>
              </View>
            ) : (
              breakdown.map((b) => {
                const cat = b.categoryId ? catMap[b.categoryId] : null;
                const pct = grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0;
                const barWidth = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0;
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
                          { width: `${barWidth}%` as DimensionValue, backgroundColor: color },
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

function BarChart({ data, incomeColor, expenseColor, mutedColor }: {
  data: BarPoint[];
  incomeColor: string;
  expenseColor: string;
  mutedColor: string;
}) {
  const H = 120;
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);

  return (
    <View style={{ gap: 10 }}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 14, alignSelf: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: incomeColor, opacity: 0.9 }} />
          <Text style={{ fontSize: 11, color: mutedColor, fontFamily: F.r }}>Masuk</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: expenseColor, opacity: 0.9 }} />
          <Text style={{ fontSize: 11, color: mutedColor, fontFamily: F.r }}>Keluar</Text>
        </View>
      </View>

      {/* Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H + 20, gap: 3 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: H, width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 }}>
              <View style={{
                flex: 1,
                height: Math.max(3, (d.income / maxVal) * H),
                backgroundColor: incomeColor,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                opacity: 0.9,
              }} />
              <View style={{
                flex: 1,
                height: Math.max(3, (d.expense / maxVal) * H),
                backgroundColor: expenseColor,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                opacity: 0.9,
              }} />
            </View>
            <Text style={{ fontSize: 9, color: mutedColor, marginTop: 4, fontFamily: F.r, textAlign: 'center' }}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scrollArea: { flex: 1, backgroundColor: c.background },

    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: 26, fontWeight: '800', color: c.text, fontFamily: F.b },

    periodRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
    periodChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    periodChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    periodText: { fontSize: 11, fontWeight: '600', color: c.text, fontFamily: F.sb },
    periodTextActive: { color: '#fff', fontFamily: F.sb },

    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 10,
      gap: 10,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    navLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text, textAlign: 'center', fontFamily: F.sb },

    container: { padding: 16, paddingBottom: 40, gap: 12 },

    card: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: c.border,
    },

    summaryCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryCol: { flex: 1, alignItems: 'center', gap: 5 },
    summaryCaption: {
      fontSize: 11,
      color: c.muted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: F.b,
    },
    summaryValue: { fontSize: 17, fontWeight: '800', fontFamily: F.b },
    summaryDivider: { width: 1, height: 36, backgroundColor: c.border },
    netRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 12,
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
    catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    catName: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    catRight: { alignItems: 'flex-end', gap: 2 },
    catPct: { fontSize: 11, color: c.muted, fontWeight: '600', fontFamily: F.sb },
    catAmount: { fontSize: 14, fontWeight: '800', color: c.text, fontFamily: F.b },
    barTrack: { height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
  });
}
