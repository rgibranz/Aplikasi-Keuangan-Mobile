// UUID v4 dibuat di klien supaya id baris STABIL lintas lokal <-> Supabase
// (tidak perlu remap id setelah sync). Memakai crypto.getRandomValues yang
// sudah dipolyfill oleh `react-native-get-random-values`. Tidak memakai
// crypto.randomUUID karena belum tentu tersedia di Hermes.
import 'react-native-get-random-values';

const HEX: string[] = [];
for (let i = 0; i < 256; i++) HEX.push((i + 0x100).toString(16).slice(1));

export function uuidv4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // versi 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  return (
    HEX[b[0]] + HEX[b[1]] + HEX[b[2]] + HEX[b[3]] + '-' +
    HEX[b[4]] + HEX[b[5]] + '-' +
    HEX[b[6]] + HEX[b[7]] + '-' +
    HEX[b[8]] + HEX[b[9]] + '-' +
    HEX[b[10]] + HEX[b[11]] + HEX[b[12]] + HEX[b[13]] + HEX[b[14]] + HEX[b[15]]
  );
}
