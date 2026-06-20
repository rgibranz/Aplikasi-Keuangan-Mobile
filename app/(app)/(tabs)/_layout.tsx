import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../../lib/theme';

function TabEmoji({ emoji, size }: { emoji: string; size: number }) {
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ size }) => <TabEmoji emoji="🏠" size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ size }) => <TabEmoji emoji="💸" size={size} />,
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: 'Dompet',
          tabBarIcon: ({ size }) => <TabEmoji emoji="👛" size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Laporan',
          tabBarIcon: ({ size }) => <TabEmoji emoji="📊" size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ size }) => <TabEmoji emoji="⚙️" size={size} />,
        }}
      />
    </Tabs>
  );
}
