import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../lib/theme';

// Placeholder — diisi penuh di Fase 4.
export default function ReportsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <Text style={styles.emoji}>📊</Text>
        <Text style={styles.title}>Laporan</Text>
        <Text style={styles.text}>Segera hadir</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  text: { fontSize: 14, color: colors.muted },
});
