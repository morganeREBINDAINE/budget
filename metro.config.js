const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Migrations Drizzle (.sql) importées par src/db/migrations/migrations.js.
config.resolver.sourceExts.push('sql');

module.exports = config;
