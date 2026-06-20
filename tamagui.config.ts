import { createTamagui } from '@tamagui/core';
import { animationsReactNative } from '@tamagui/config/v5-rn';
import { tokens, shorthands } from '@tamagui/config/v5';
import { themes } from './themes';

const config = createTamagui({
  animations: animationsReactNative,
  defaultTheme: 'light',
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: false,
  themes,
  tokens,
  shorthands,
  settings: {
    fastSchemeChange: true,
  },
  fonts: {},
});

export type AppConfig = typeof config;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
