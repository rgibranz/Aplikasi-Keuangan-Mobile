import { useEffect } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { Slot, router, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { AppThemeProvider, useThemeColors, useColorMode } from '../lib/ThemeProvider';
import { useSyncTriggers } from '../lib/sync/triggers';
import { updateWidgetsSoon } from '../lib/widget/snapshot';
import { rescheduleStaleTemplates } from '../lib/recurring';
import { OfflineBanner } from '../components/OfflineBanner';
import { useFonts, IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as Notifications.NotificationBehavior),
});

function RootNavigator() {
  const { session, isGuest, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === '(auth)';
  const colors = useThemeColors();
  const colorMode = useColorMode();

  // Sinkronisasi otomatis saat login (hidrasi awal, kembali online, foreground).
  useSyncTriggers(!!session);

  useEffect(() => {
    if (isLoading) return;

    // Tamu (isGuest) boleh masuk app DAN boleh mengakses layar (auth) untuk
    // upgrade jadi akun. Hanya sesi asli yang ditendang keluar dari grup (auth).
    if (!session && !isGuest && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, isGuest, isLoading, inAuthGroup, router]);

  const isRedirecting =
    (!session && !isGuest && !inAuthGroup) || (session && inAuthGroup);
  if (isLoading || isRedirecting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <OfflineBanner />
      <StatusBar style={colorMode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

function AppLayout() {
  useEffect(() => {
    updateWidgetsSoon(); // seed snapshot widget saat app dibuka
    void rescheduleStaleTemplates();

    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('recurring', {
        name: 'Transaksi Rutin',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        updateWidgetsSoon();
        void rescheduleStaleTemplates();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        templateId?: string;
        transactionType?: string;
        walletId?: string;
        categoryId?: string;
        destinationWalletId?: string | null;
        amount?: number;
        notes?: string | null;
      };
      if (data?.templateId) {
        router.push({
          pathname: '/(app)/transaction-form',
          params: {
            templateId: data.templateId,
            prefillType: data.transactionType ?? '',
            prefillWalletId: data.walletId ?? '',
            prefillCategoryId: data.categoryId ?? '',
            prefillDestWalletId: data.destinationWalletId ?? '',
            prefillAmount: String(data.amount ?? 0),
            prefillNotes: data.notes ?? '',
          },
        });
      }
    });

    return () => {
      appStateSub.remove();
      notifSub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <AppLayout />
    </AppThemeProvider>
  );
}
