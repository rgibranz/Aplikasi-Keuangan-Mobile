import { useCallback, useState } from 'react';
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
import { useAuth } from '../../../lib/auth';
import { getWallets } from '../../../lib/wallets';
import { getCategories } from '../../../lib/categories';
import { getTransactions } from '../../../lib/transactions';
import { formatDateShort } from '../../../lib/format';
import { colors } from '../../../lib/theme';

export default function ProfileScreen() {
  const { session, signOut, updatePassword } = useAuth();
  const router = useRouter();
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

  const email = session?.user.email ?? '';
  const initial = email ? email[0].toUpperCase() : '?';
  const createdAt = session?.user.created_at;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  function confirmSignOut() {
    Alert.alert('Keluar?', 'Kamu akan keluar dari akun ini.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profil</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
          {createdAt ? (
            <Text style={styles.member}>Bergabung {formatDateShort(createdAt)}</Text>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <Stat label="Dompet" value={counts.wallets} />
          <Stat label="Transaksi" value={counts.transactions} />
          <Stat label="Kategori" value={counts.categories} />
        </View>

        <View style={styles.menu}>
          <MenuItem
            emoji="🏷️"
            label="Kelola Kategori"
            onPress={() => router.push('/categories')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            emoji="🔑"
            label="Ganti Password"
            onPress={() => setPwVisible(true)}
          />
        </View>

        <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Keluar</Text>
        </Pressable>

        <Text style={styles.version}>AplikasiKeuangan v{version}</Text>
      </ScrollView>

      <ChangePasswordModal
        visible={pwVisible}
        onClose={() => setPwVisible(false)}
        onSubmit={updatePassword}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 18 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 4 },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  email: { fontSize: 16, fontWeight: '700', color: colors.text },
  member: { fontSize: 13, color: colors.muted },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  menu: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  menuEmoji: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  menuArrow: { fontSize: 22, color: colors.muted, fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  signOutBtn: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', color: colors.muted, fontSize: 12 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  modalCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  modalSave: { backgroundColor: colors.primary },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
