// Format angka jadi Rupiah, contoh: 1500000 -> "Rp 1.500.000".
// Ditulis manual (tanpa Intl) supaya pasti jalan di Hermes/Android.
export function formatRupiah(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${digits}`;
}

const BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// "16 Jun 2026"
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Label grup untuk daftar transaksi: "Hari ini" / "Kemarin" / "Senin, 16 Jun 2026"
export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

const BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// "Juni 2026"
export function monthYearLabel(d: Date): string {
  return `${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}
