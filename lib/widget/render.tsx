import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetRepresentation } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';

// Palet widget (cermin warna app). Self-contained — tidak mengimpor
// ThemeProvider/Tamagui supaya bundle headless tetap ringan.
type WC = {
  bg: `#${string}`;
  card: `#${string}`;
  primary: `#${string}`;
  text: `#${string}`;
  muted: `#${string}`;
  income: `#${string}`;
  danger: `#${string}`;
};

const LIGHT: WC = {
  bg: '#FAF7F2', card: '#FFFFFF', primary: '#C2410C', text: '#1C1917',
  muted: '#78716C', income: '#15803D', danger: '#DC2626',
};
const DARK: WC = {
  bg: '#141210', card: '#1E1A17', primary: '#E05A1F', text: '#F5F0EB',
  muted: '#9C8F86', income: '#22C55E', danger: '#F87171',
};

function Saldo(c: WC, s: WidgetSnapshot) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.card, borderRadius: 24, padding: 16, flexDirection: 'column', justifyContent: 'center' }}
    >
      <TextWidget text="TOTAL SALDO" style={{ fontSize: 11, color: c.muted, fontWeight: '600', letterSpacing: 1 }} />
      <TextWidget text={s.totalSaldoText} style={{ fontSize: 26, color: c.text, fontWeight: '700', marginTop: 4 }} />
      <TextWidget text={s.dompetText} style={{ fontSize: 12, color: c.muted, marginTop: 4 }} />
    </FlexWidget>
  );
}

function CatatCepat(c: WC, _s: WidgetSnapshot) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'uangkita://transaction-form' }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.primary, borderRadius: 24, padding: 10, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
    >
      <TextWidget text="＋" style={{ fontSize: 30, color: '#FFFFFF', fontWeight: '700' }} />
      <TextWidget text="Catat" style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '700', marginTop: 2 }} />
    </FlexWidget>
  );
}

function Ringkasan(c: WC, s: WidgetSnapshot) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.card, borderRadius: 24, padding: 16, flexDirection: 'column', justifyContent: 'center' }}
    >
      <TextWidget text={s.bulanLabel} style={{ fontSize: 12, color: c.muted, fontWeight: '600' }} />
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 10 }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="Masuk" style={{ fontSize: 11, color: c.muted }} />
          <TextWidget text={s.incomeText} style={{ fontSize: 15, color: c.income, fontWeight: '700', marginTop: 2 }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="Keluar" style={{ fontSize: 11, color: c.muted }} />
          <TextWidget text={s.expenseText} style={{ fontSize: 15, color: c.danger, fontWeight: '700', marginTop: 2 }} />
        </FlexWidget>
      </FlexWidget>
      <TextWidget text={`Selisih  ${s.netText}`} style={{ fontSize: 12, color: c.text, fontWeight: '600', marginTop: 10 }} />
    </FlexWidget>
  );
}

function Terbaru(c: WC, s: WidgetSnapshot) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.card, borderRadius: 24, padding: 14, flexDirection: 'column' }}
    >
      <TextWidget text="Transaksi terbaru" style={{ fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 8 }} />
      {s.recent.length === 0 ? (
        <TextWidget text="Belum ada transaksi" style={{ fontSize: 13, color: c.muted }} />
      ) : (
        s.recent.map((t, i) => (
          <FlexWidget key={`${i}`} style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', marginBottom: 6 }}>
            <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
              <TextWidget text={t.title} style={{ fontSize: 13, color: c.text, fontWeight: '600' }} maxLines={1} truncate="END" />
              <TextWidget text={t.subtitle} style={{ fontSize: 10, color: c.muted, marginTop: 1 }} maxLines={1} truncate="END" />
            </FlexWidget>
            <TextWidget
              text={t.amountText}
              style={{ fontSize: 13, fontWeight: '700', color: t.kind === 'income' ? c.income : t.kind === 'transfer' ? c.text : c.danger }}
            />
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}

export function renderWidgetByName(name: string, snap: WidgetSnapshot): WidgetRepresentation {
  const fn = name === 'CatatCepat' ? CatatCepat : name === 'Ringkasan' ? Ringkasan : name === 'Terbaru' ? Terbaru : Saldo;
  return { light: fn(LIGHT, snap), dark: fn(DARK, snap) };
}
