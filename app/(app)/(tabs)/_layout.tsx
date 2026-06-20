import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useThemeColors, F } from '../../../lib/ThemeProvider';

export default function TabsLayout() {
  const colors = useThemeColors();

  function TabBarButton({ children, onPress, onLongPress, style, accessibilityState }: any) {
    const active = accessibilityState?.selected;
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={[style, s.btn]}>
        <View style={[s.pill, active && { backgroundColor: colors.primary + '20' }]}>
          {children}
        </View>
      </Pressable>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: TabBarButton,
        tabBarLabelStyle: { fontFamily: F.m, fontSize: 10 },
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          height: 80,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, size }) => <Feather name="credit-card" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: 'Dompet',
          tabBarIcon: ({ color, size }) => <Feather name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Laporan',
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 60,
  },
});
