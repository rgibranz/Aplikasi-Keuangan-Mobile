import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDb } from '../db';
import { currentUserIdOrNull } from '../db/user';
import { monthlyTotals } from '../stats';
import { formatRupiah, monthYearLabel } from '../format';
import type { Transaction } from '../types';

// Nama widget — harus SAMA dengan "name" di config plugin app.json.
export const WIDGET_NAMES = ['Saldo', 'CatatCepat', 'Ringkasan', 'Terbaru'] as const;

export type WidgetRecent = {
  title: string;
  subtitle: string;
  amountText: string;
  kind: 'income' | 'expense' | 'transfer';
};

// Snapshot = ringkasan kecil yang ditulis app ke AsyncStorage. Widget (proses
// launcher / headless JS) cukup BACA snapshot ini — tak menyentuh DB langsung.
export type WidgetSnapshot = {
  totalSaldoText: string;
  dompetText: string;
  bulanLabel: string;
  incomeText: string;
  expenseText: string;
  netText: string;
  recent: WidgetRecent[];
};

const KEY = 'widget_snapshot_v1';

function emptySnapshot(): WidgetSnapshot {
  const zero = formatRupiah(0);
  return {
    totalSaldoText: zero,
    dompetText: 'Belum ada dompet',
    bulanLabel: monthYearLabel(new Date()),
    incomeText: '+' + zero,
    expenseText: '-' + zero,
    netText: '+' + zero,
    recent: [],
  };
}

// Dihitung di sisi APP (punya akses DB). Memakai currentUserId aktif, jadi
// otomatis benar untuk mode tamu maupun login.
export async function buildSnapshot(): Promise<WidgetSnapshot> {
  const uid = await currentUserIdOrNull();
  if (!uid) return emptySnapshot();

  const db = await getDb();
  const wallets = await db.getAllAsync<{ id: string; wallet_name: string; current_balance: number }>(
    'select id, wallet_name, current_balance from wallets where user_id = ? and deleted_at is null',
    [uid],
  );
  const total = wallets.reduce((s, w) => s + Number(w.current_balance), 0);
  const balanceRaw = await AsyncStorage.getItem('@balance_visible');
  const balanceVisible = balanceRaw !== 'false';
  const wMap: Record<string, string> = {};
  for (const w of wallets) wMap[w.id] = w.wallet_name;

  const txs = await db.getAllAsync<Transaction>(
    'select id, user_id, wallet_id, destination_wallet_id, category_id, transaction_type, amount, notes, transaction_date from transactions where user_id = ? and deleted_at is null order by transaction_date desc',
    [uid],
  );
  const now = new Date();
  const { income, expense } = monthlyTotals(txs, now);
  const net = income - expense;

  const cats = await db.getAllAsync<{ id: string; category_name: string }>(
    'select id, category_name from categories where user_id = ? and deleted_at is null',
    [uid],
  );
  const catMap: Record<string, string> = {};
  for (const c of cats) catMap[c.id] = c.category_name;

  const recent: WidgetRecent[] = txs.slice(0, 5).map((t) => {
    const isIncome = t.transaction_type === 'Income';
    const isTransfer = t.transaction_type === 'Transfer';
    const title = isTransfer
      ? 'Transfer'
      : t.category_id && catMap[t.category_id]
        ? catMap[t.category_id]
        : isIncome
          ? 'Pemasukan'
          : 'Pengeluaran';
    const subtitle = isTransfer
      ? `${wMap[t.wallet_id] ?? '?'} → ${t.destination_wallet_id ? wMap[t.destination_wallet_id] ?? '?' : '?'}`
      : t.notes || wMap[t.wallet_id] || '';
    const sign = isIncome ? '+' : isTransfer ? '' : '-';
    return {
      title,
      subtitle,
      amountText: sign + formatRupiah(Number(t.amount)),
      kind: isIncome ? 'income' : isTransfer ? 'transfer' : 'expense',
    };
  });

  return {
    totalSaldoText: balanceVisible ? formatRupiah(total) : '••••••',
    dompetText: wallets.length === 0 ? 'Belum ada dompet' : `dari ${wallets.length} dompet`,
    bulanLabel: monthYearLabel(now),
    incomeText: '+' + formatRupiah(income),
    expenseText: '-' + formatRupiah(expense),
    netText: (net >= 0 ? '+' : '') + formatRupiah(net),
    recent,
  };
}

// Dibaca oleh widget task handler (headless) maupun app.
export async function readSnapshot(): Promise<WidgetSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    // abaikan
  }
  return emptySnapshot();
}

async function storeSnapshot(s: WidgetSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // abaikan
  }
}

// Hitung snapshot baru, simpan, lalu minta semua widget render ulang.
// Android-only; require lazy supaya iOS/web tak memuat modul native widget.
export async function updateAllWidgets(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const snap = await buildSnapshot();
  await storeSnapshot(snap);
  const { requestWidgetUpdate } = require('react-native-android-widget');
  const { renderWidgetByName } = require('./render');
  for (const name of WIDGET_NAMES) {
    try {
      await requestWidgetUpdate({
        widgetName: name,
        renderWidget: () => renderWidgetByName(name, snap),
        widgetNotFound: () => {},
      });
    } catch {
      // widget belum dipasang / error render — abaikan
    }
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
// Dipanggil setelah mutasi / sync / foreground. Di-debounce.
export function updateWidgetsSoon(delayMs = 1500): void {
  if (Platform.OS !== 'android') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void updateAllWidgets();
  }, delayMs);
}
