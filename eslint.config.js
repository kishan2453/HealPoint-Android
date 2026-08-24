// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  // Global ignores — generated / native folders that should never be linted.
  {
    ignores: ['dist/*', '.expo/**', 'HealPointNative/**'],
  },
  // Node.js scripts (detect-lan-ip, generate-brand-icons) need Node globals.
  {
    files: ['scripts/**/*.js', '*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);
