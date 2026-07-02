import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useThemeColors, type AppColors, F } from '../../lib/ThemeProvider';

// Riwayat perubahan aplikasi. Tambah entri BARU di paling ATAS array.
type ChangelogEntry = { version?: string; date: string; title: string; items: string[] };

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.7.5',
    date: '28 Jun 2026',
    title: 'Rata-rata harian',
    items: [
      'Ringkasan periode kini menampilkan rata-rata pemasukan & pengeluaran per hari.',
    ],
  },
  {
    version: '0.7.4',
    date: '28 Jun 2026',
    title: 'Ukuran aplikasi lebih kecil',
    items: [
      'Ukuran file APK dipangkas — unduhan & pemasangan jadi lebih ringan.',
    ],
  },
  {
    version: '0.7.3',
    date: '28 Jun 2026',
    title: 'Sesuaikan saldo',
    items: [
      'Tombol "Sesuaikan saldo" di detail dompet — samakan saldo aplikasi dengan saldo nyata, selisihnya dicatat otomatis sebagai penyesuaian.',
    ],
  },
  {
    version: '0.7.0',
    date: '22 Jun 2026',
    title: 'Riwayat perubahan',
    items: [
      'Halaman ini — lihat semua perubahan aplikasi dari Profil.',
    ],
  },
  {
    version: '0.6.0',
    date: '22 Jun 2026',
    title: 'Dompet tabungan & investasi',
    items: [
      'Jenis dompet baru: Tabungan & Investasi.',
      'Opsi kecualikan dompet dari total saldo (dompet tetap tampil, tapi tidak dihitung).',
      'Bisa diubah kapan saja lewat halaman detail dompet.',
    ],
  },
  {
    version: '0.5.4',
    date: '22 Jun 2026',
    title: 'Kategori pemasukan bawaan',
    items: [
      'Template kategori pemasukan siap-pakai: Gaji, Bonus, Freelance, Usaha, Investasi, Hadiah.',
    ],
  },
  {
    version: '0.4.2',
    date: '21 Jun 2026',
    title: 'Transaksi rutin',
    items: [
      'Template transaksi berulang: harian, mingguan, bulanan, tahunan.',
      'Notifikasi pengingat saat jatuh tempo.',
      'Tap notifikasi langsung mengisi form transaksi.',
    ],
  },
  {
    date: '21 Jun 2026',
    title: 'Sembunyikan saldo',
    items: [
      'Ikon mata untuk menyembunyikan total saldo di home, dompet, dan widget.',
    ],
  },
  {
    date: '21 Jun 2026',
    title: 'Widget & mode tamu',
    items: [
      '4 widget layar utama Android.',
      'Mode Tamu — pakai aplikasi tanpa akun (data lokal di HP).',
    ],
  },
  {
    date: '21 Jun 2026',
    title: 'Offline-first & multi-device',
    items: [
      'Penyimpanan offline-first (SQLite) — aplikasi jalan tanpa internet.',
      'Sinkronisasi otomatis antar perangkat lewat Supabase.',
    ],
  },
  {
    date: '21 Jun 2026',
    title: 'Tampilan & laporan',
    items: [
      'Tema gelap/terang, font baru, navbar dirapikan.',
      'Laporan dengan pemilih periode (harian/mingguan/bulanan/tahunan) + grafik batang.',
      'Halaman detail dompet.',
    ],
  },
  {
    date: '20 Jun 2026',
    title: 'Rilis awal',
    items: [
      'Login & daftar akun.',
      'Dompet, kategori, dan transaksi.',
      'Ringkasan bulanan + transaksi terbaru di home.',
      'Laporan bulanan per kategori.',
      'Profil: info akun, statistik, ganti password.',
    ],
  },
];

export default function ChangelogScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Riwayat Perubahan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {CHANGELOG.map((entry, i) => (
          <View key={`${entry.date}-${i}`} style={styles.card}>
            <View style={styles.cardHead}>
              {entry.version ? (
                <View style={styles.versionBadge}>
                  <Text style={styles.versionText}>v{entry.version}</Text>
                </View>
              ) : null}
              <Text style={styles.date}>{entry.date}</Text>
            </View>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            {entry.items.map((it, j) => (
              <View key={j} style={styles.itemRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{it}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    scroll: { flex: 1, backgroundColor: c.background },
    container: { padding: 20, gap: 12, paddingBottom: 40 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      gap: 8,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      fontFamily: F.b,
    },

    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    versionBadge: {
      backgroundColor: c.primary + '18',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    versionText: { fontSize: 12, fontWeight: '800', color: c.primary, fontFamily: F.b },
    date: { fontSize: 12, color: c.muted, fontFamily: F.r },
    cardTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 8, fontFamily: F.b },
    itemRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    bullet: { fontSize: 14, color: c.muted, lineHeight: 20, fontFamily: F.r },
    itemText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 20, fontFamily: F.r },
  });
}
