// Entry: pertahankan Expo Router lalu daftarkan handler widget (Android).
// package.json "main" menunjuk ke file ini.
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./lib/widget/handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
