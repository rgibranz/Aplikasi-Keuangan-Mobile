import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth';
import { getWallets } from '../../../lib/wallets';
import { getCategories } from '../../../lib/categories';
import { getTransactions } from '../../../lib/transactions';
import { formatDateShort } from '../../../lib/format';
import { useThemeColors, type AppColors, F } from '../../../lib/ThemeProvider';
import { useRefreshOnSync } from '../../../lib/sync';

export default function ProfileScreen() {
  const { session, signOut, updatePassword, isGuest } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [counts, setCounts] = useState({ wallets: 0, transactions: 0, categories: 0 });
  const [pwVisible, setPwVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, tx, c] = await Promise.all([
        getWallets(),
        getTransactions(),
        getCategories(),
      ]);
      setCounts({ wallets: w.length, transactions: tx.length, categories: c.length });
    } catch {
      // diabaikan
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useRefreshOnSync(load);

  const email = session?.user.email ?? '';
  const initial = isGuest ? 'T' : email ? email[0].toUpperCase() : '?';
  const createdAt = session?.user.created_at;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  function confirmSignOut() {
    Alert.alert(
      isGuest ? 'Keluar mode tamu?' : 'Keluar?',
      isGuest ? 'Data tamu tetap tersimpan di HP ini.' : 'Kamu akan keluar dari akun ini.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.email} numberOfLines={1}>{isGuest ? 'Mode Tamu' : email}</Text>
            {isGuest ? (
              <Text style={styles.member}>Data tersimpan di HP ini</Text>
            ) : createdAt ? (
              <Text style={styles.member}>Bergabung {formatDateShort(createdAt)}</Text>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat label="Dompet" value={counts.wallets} colors={colors} />
          <Stat label="Transaksi" value={counts.transactions} colors={colors} />
          <Stat label="Kategori" value={counts.categories} colors={colors} />
        </View>

        {/* Upgrade CTA — hanya untuk tamu */}
        {isGuest ? (
          <Pressable style={styles.upgradeCard} onPress={() => router.push('/sign-in')}>
            <View style={styles.upgradeIcon}>
              <Feather name="cloud" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>Cadangkan & multi-device</Text>
              <Text style={styles.upgradeText}>Daftar atau masuk untuk simpan ke cloud.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem
            icon="tag"
            label="Kelola Kategori"
            onPress={() => router.push('/categories')}
            colors={colors}
          />
          {!isGuest ? (
            <>
              <View style={styles.menuDivider} />
              <MenuItem
                icon="lock"
                label="Ganti Password"
                onPress={() => setPwVisible(true)}
                colors={colors}
              />
            </>
          ) : null}
        </View>

        <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
          <Feather name="log-out" size={16} color={colors.danger} />
          <Text style={styles.signOutText}>{isGuest ? 'Keluar dari mode tamu' : 'Keluar dari akun'}</Text>
        </Pressable>

        <Text style={styles.version}>v{version}</Text>
      </ScrollView>

      <ChangePasswordModal
        visible={pwVisible}
        onClose={() => setPwVisible(false)}
        onSubmit={updatePassword}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, colors }: { label: string; value: number; colors: AppColors }) {
  const styles = getStyles(colors);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  colors: AppColors;
}) {
  const styles = getStyles(colors);
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

function ChangePasswordModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<{ error: string | null }>;
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (pw.length < 6) {
      Alert.alert('Terlalu pendek', 'Password minimal 6 karakter.');
      return;
    }
    if (pw !== confirm) {
      Alert.alert('Tidak cocok', 'Konfirmasi password berbeda.');
      return;
    }
    setSaving(true);
    const { error } = await onSubmit(pw);
    setSaving(false);
    if (error) {
      Alert.alert('Gagal', error);
      return;
    }
    setPw('');
    setConfirm('');
    onClose();
    Alert.alert('Berhasil', 'Password kamu sudah diperbarui.');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Ganti Password</Text>

          <Text style={styles.label}>Password baru</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Minimal 6 karakter"
            placeholderTextColor={colors.muted}
            value={pw}
            onChangeText={setPw}
          />

          <Text style={styles.label}>Konfirmasi password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Ulangi password"
            placeholderTextColor={colors.muted}
            value={confirm}
            onChangeText={setConfirm}
          />

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, styles.modalCancel]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.modalCancelText}>Batal</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, styles.modalSave, saving && { opacity: 0.6 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveText}>Simpan</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.surface },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
    scroll: { flex: 1, backgroundColor: c.background },
    container: { padding: 20, gap: 14 },
    title: { fontSize: 26, fontWeight: '800', color: c.text, fontFamily: F.b },

    profileCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 24, fontWeight: '800', fontFamily: F.b },
    profileInfo: { flex: 1 },
    email: { fontSize: 15, fontWeight: '700', color: c.text, fontFamily: F.b },
    member: { fontSize: 12, color: c.muted, marginTop: 3, fontFamily: F.r },

    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 4,
    },
    statValue: { fontSize: 22, fontWeight: '800', color: c.text, fontFamily: F.b },
    statLabel: { fontSize: 11, color: c.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F.sb },

    menu: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    menuIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text, fontFamily: F.sb },
    menuDivider: { height: 1, backgroundColor: c.border, marginLeft: 66 },

    signOutBtn: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    signOutText: { color: c.danger, fontSize: 15, fontWeight: '700', fontFamily: F.b },
    version: { textAlign: 'center', color: c.muted, fontSize: 12, fontFamily: F.r },
    upgradeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.primary,
      padding: 16,
    },
    upgradeIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upgradeTitle: { fontSize: 14, fontWeight: '700', color: c.text, fontFamily: F.b },
    upgradeText: { fontSize: 12, color: c.muted, marginTop: 2, fontFamily: F.r },

    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 36,
    },
    modalHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 18,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: c.text, fontFamily: F.b },
    label: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6, marginTop: 16, fontFamily: F.sb },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
      fontFamily: F.r,
    },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    modalCancel: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    modalCancelText: { color: c.text, fontWeight: '700', fontSize: 15, fontFamily: F.b },
    modalSave: { backgroundColor: c.primary },
    modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: F.b },
  });
}
