import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatRupiah } from '../lib/format';
import { colors } from '../lib/theme';
import type { Category, Transaction, Wallet } from '../lib/types';

// Baris transaksi yang dipakai bersama oleh layar Transaksi & Beranda.
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
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.icon, { backgroundColor: tint + '22' }]}>
        <Text style={styles.emoji}>{emoji}</Text>
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

const styles = StyleSheet.create({
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
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  mid: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800' },
});
