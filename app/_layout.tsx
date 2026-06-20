import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (isLoading) return;

    if (!session && !inAuthGroup) {
      // Belum login & mencoba akses halaman privat -> ke layar masuk.
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      // Sudah login tapi masih di layar auth -> ke beranda.
      router.replace('/');
    }
  }, [session, isLoading, inAuthGroup, router]);

  // Tampilkan loader saat mengecek sesi atau saat sedang mengalihkan halaman,
  // supaya layar yang salah tidak sempat berkedip.
  const isRedirecting =
    (!session && !inAuthGroup) || (session && inAuthGroup);
  if (isLoading || isRedirecting) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  useEffect(() => {
    // Refresh token otomatis hanya saat app aktif di foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
