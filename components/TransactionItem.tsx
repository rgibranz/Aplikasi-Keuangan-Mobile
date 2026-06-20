import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatRupiah } from '../lib/format';
import { useThemeColors, type AppColors, F } from '../lib/ThemeProvider';
import type { Category, Transaction, Wallet } from '../lib/types';

export function TransactionItem({
  t,
  walletMap,
  catMap,
  onPress,
  onLongPress,
}: {
  t: Transaction;
  walletMap: Record<string, Wallet>;
  catMap: Record<string, Category>;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const isIncome = t.transaction_type === 'Income';
  const isTransfer = t.transaction_type === 'Transfer';
  const cat = t.category_id ? catMap[t.category_id] : null;
  const wallet = walletMap[t.wallet_id];
  const dest = t.destination_wallet_id ? walletMap[t.destination_wallet_id] : null;

  const catEmoji = !isTransfer ? (cat?.icon_name ?? null) : null;
  const featherIcon: React.ComponentProps<typeof Feather>['name'] = isTransfer
    ? 'repeat'
    : isIncome
      ? 'trending-up'
      : 'trending-down';

  const tint = isTransfer
    ? colors.muted
    : cat?.color_hex ?? (isIncome ? colors.income : colors.danger);
  const title = isTransfer
    ? 'Transfer'
    : cat?.category_name ?? (isIncome ? 'Pemasukan' : 'Pengeluaran');
  const subtitle = isTransfer
    ? `${wallet?.wallet_name ?? '?'} → ${dest?.wallet_name ?? '?'}`
    : wallet?.wallet_name ?? '';
  const sign = isIncome ? '+' : isTransfer ? '' : '-';
  const amountColor = isIncome
    ? colors.income
    : isTransfer
      ? colors.text
      : colors.danger;

  return (
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.icon, { backgroundColor: tint + '20' }]}>
        {catEmoji ? (
          <Text style={styles.emoji}>{catEmoji}</Text>
        ) : (
          <Feather name={featherIcon} size={18} color={tint} />
        )}
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
          {t.notes ? ` · ${t.notes}` : ''}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {sign}
        {formatRupiah(Number(t.amount))}
      </Text>
    </Pressable>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: { fontSize: 18 },
    mid: { flex: 1 },
    title: { fontSize: 15, fontWeight: '700', color: c.text, fontFamily: F.b },
    sub: { fontSize: 12, color: c.muted, marginTop: 2, fontFamily: F.r },
    amount: { fontSize: 15, fontWeight: '800', fontFamily: F.b },
  });
}
