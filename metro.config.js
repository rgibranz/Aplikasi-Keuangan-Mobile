const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Shim react-dom for React Native — @tamagui/web imports it but only uses
// it in dev+web code paths (typeof document !== 'undefined' guard).
config.resolver.extraNodeModules = {
  'react-dom': path.resolve(__dirname, 'shims/react-dom.js'),
};

// Tamagui needs mjs resolution
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
