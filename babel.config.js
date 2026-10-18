module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Migrations Drizzle : les fichiers .sql sont embarqués comme chaînes.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
