import { Stack } from 'expo-router';

// Lapisan Stack untuk area yang sudah login.
// Berisi grup (tabs) + layar-layar yang di-push di atas tab (form, kelola data).
export default function AppStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="recurring" />
      <Stack.Screen name="recurring-form" />
      <Stack.Screen name="changelog" />
      <Stack.Screen name="transaction-form" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
