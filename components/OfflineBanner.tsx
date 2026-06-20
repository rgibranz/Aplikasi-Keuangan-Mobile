import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useThemeColors, F } from '../lib/ThemeProvider';

// Pil kecil di atas layar saat offline. pointerEvents="none" supaya tidak
// menghalangi sentuhan. Menegaskan ke user bahwa perubahan tetap tersimpan.
export function OfflineBanner() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <View style={[styles.pill, { backgroundColor: colors.text }]}>
        <Text style={[styles.text, { color: colors.background }]}>
          Mode offline · tersimpan di HP
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    opacity: 0.92,
  },
  text: { fontSize: 12, fontFamily: F.m },
});
