import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useThemeColors, type AppColors } from '../../lib/ThemeProvider';

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Lengkapi dulu', 'Email dan password wajib diisi.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password terlalu pendek', 'Minimal 6 karakter.');
      return;
    }
    setLoading(true);
    const { error, needsConfirmation } = await signUp(email.trim(), password);
    setLoading(false);

    if (error) {
      Alert.alert('Gagal daftar', error);
      return;
    }
    if (needsConfirmation) {
      Alert.alert(
        'Cek email kamu',
        'Akun berhasil dibuat. Klik link konfirmasi di email, lalu masuk.',
        [{ text: 'OK', onPress: () => router.replace('/sign-in') }],
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.brandMark}>
            <Text style={styles.brandIcon}>₿</Text>
          </View>
          <Text style={styles.brand}>Catatan Keuangan</Text>
          <Text style={styles.title}>Buat akun baru</Text>
          <Text style={styles.subtitle}>Mulai catat keuanganmu hari ini.</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="kamu@email.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimal 6 karakter"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Daftar Sekarang</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Sudah punya akun? </Text>
            <Link href="/sign-in" style={styles.link}>Masuk</Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    container: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: 'center',
      gap: 4,
    },
    brandMark: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: c.primary,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    brandIcon: { color: '#fff', fontSize: 26, fontWeight: '800' },
    brand: {
      fontSize: 12,
      fontWeight: '700',
      color: c.muted,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    title: { fontSize: 30, fontWeight: '800', color: c.text, lineHeight: 36 },
    subtitle: { fontSize: 15, color: c.muted, marginTop: 6, marginBottom: 8 },
    form: { marginTop: 24, gap: 4 },
    field: { gap: 6, marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: c.text },
    input: {
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 17,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: c.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
    footerText: { color: c.muted, fontSize: 14 },
    link: { color: c.primary, fontSize: 14, fontWeight: '700' },
  });
}
