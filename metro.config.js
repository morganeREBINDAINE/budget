const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Config Expo + Debug IDs Sentry (relie le bundle à ses source maps envoyées au build release).
/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Migrations Drizzle (.sql) importées par src/db/migrations/migrations.js.
config.resolver.sourceExts.push('sql');

module.exports = config;
