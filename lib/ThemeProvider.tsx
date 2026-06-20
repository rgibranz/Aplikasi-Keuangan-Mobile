import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { TamaguiProvider } from '@tamagui/core';
import config from '../tamagui.config';

export type ColorMode = 'light' | 'dark';

export const lightColors = {
  primary:     '#C2410C',
  primaryDark: '#9A3412',
  background:  '#FAF7F2',
  card:        '#FFFFFF',
  surface:     '#F5EFE6',
  text:        '#1C1917',
  muted:       '#78716C',
  border:      '#E7DDD0',
  danger:      '#DC2626',
  income:      '#15803D',
};

export const darkColors = {
  primary:     '#E05A1F',
  primaryDark: '#C2410C',
  background:  '#141210',
  card:        '#1E1A17',
  surface:     '#2A2420',
  text:        '#F5F0EB',
  muted:       '#9C8F86',
  border:      '#3D332C',
  danger:      '#F87171',
  income:      '#22C55E',
};

export const F = {
  r:  'IBMPlexMono_400Regular',
  m:  'IBMPlexMono_500Medium',
  sb: 'IBMPlexMono_600SemiBold',
  b:  'IBMPlexMono_700Bold',
};

export type AppColors = typeof lightColors;

type ThemeCtx = {
  colorMode: ColorMode;
  colors: AppColors;
};

const ThemeContext = createContext<ThemeCtx>({
  colorMode: 'light',
  colors: lightColors,
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme();
  const colorMode: ColorMode = sys === 'dark' ? 'dark' : 'light';
  const colors = colorMode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colorMode, colors }}>
      <TamaguiProvider config={config} defaultTheme={colorMode}>
        {children}
      </TamaguiProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeColors(): AppColors {
  return useContext(ThemeContext).colors;
}

export function useColorMode(): ColorMode {
  return useContext(ThemeContext).colorMode;
}
