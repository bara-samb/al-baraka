const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Par défaut, terser échappe tout caractère non ASCII (\u06xx) : le texte arabe du Mushaf
// triplait de volume et le bundle web dépassait 5 Mo. On le garde tel quel (UTF-8).
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  output: { ...config.transformer.minifierConfig.output, ascii_only: false },
};

module.exports = config;
