import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncNow } from './index';

// Memasang pemicu sinkronisasi otomatis selama user login:
//   - sekali saat aktif (hidrasi awal)
//   - tiap app kembali ke foreground
//   - tiap koneksi kembali online
export function useSyncTriggers(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    void syncNow(); // hidrasi awal / catch-up

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });

    const netUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncNow();
    });

    return () => {
      appSub.remove();
      netUnsub();
    };
  }, [enabled]);
}
