import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getRecurringTemplates, toggleTemplateActive, type RecurringTemplate,
} from '../../lib/recurring';
import { formatRupiah } from '../../lib/format';
import { useThemeColors, type AppColors, F } from '../../lib/ThemeProvider';

const RECURRENCE_LABEL: Record<string, string> = {
  daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan',
};

export default function RecurringScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTemplates(await getRecurringTemplates());
    } catch {
      // abaikan
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleToggle(t: RecurringTemplate, value: boolean) {
    await toggleTemplateActive(t.id, value);
    void load();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Transaksi Rutin</Text>
        <Pressable onPress={() => router.push('/recurring-form')} hitSlop={8}>
          <Feather name="plus" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="repeat" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>Belum ada transaksi rutin</Text>
              <Text style={styles.emptyText}>
                Tap tombol + untuk menambah pengingat transaksi rutin.
              </Text>
            </View>
          }
          renderItem={({ item: t }) => (
            <Pressable
              style={[styles.card, !t.is_active && styles.cardInactive]}
              onPress={() =>
                router.push({ pathname: '/recurring-form', params: { id: t.id } })
              }
            >
              <View style={styles.cardMain}>
                <Text style={styles.cardLabel}>{t.label}</Text>
                <View style={styles.cardMeta}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{RECURRENCE_LABEL[t.recurrence]}</Text>
                  </View>
                  <Text style={styles.cardAmount}>
                    {t.amount > 0 ? formatRupiah(t.amount) : 'Variable'}
                  </Text>
                </View>
              </View>
              <Switch
                value={!!t.is_active}
                onValueChange={(v) => void handleToggle(t, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
      backgroundColor: c.surface,
    },
    title: { fontSize: 20, fontWeight: '800', color: c.text, fontFamily: F.b },
    list: { padding: 20, paddingBottom: 40, gap: 10 },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: c.border, gap: 12,
    },
    cardInactive: { opacity: 0.5 },
    cardMain: { flex: 1, gap: 6 },
    cardLabel: { fontSize: 15, fontWeight: '700', color: c.text, fontFamily: F.b },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badge: {
      backgroundColor: c.surface, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: c.border,
    },
    badgeText: { fontSize: 11, fontWeight: '600', color: c.muted, fontFamily: F.sb },
    cardAmount: { fontSize: 13, fontWeight: '600', color: c.text, fontFamily: F.sb },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, fontFamily: F.b },
    emptyText: {
      fontSize: 13, color: c.muted, textAlign: 'center',
      paddingHorizontal: 40, fontFamily: F.r,
    },
  });
}
