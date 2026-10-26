// Publie une mise à jour EAS Update sur le canal `production`, puis envoie
// les source maps du bundle à Sentry si le projet l'utilise (sinon les erreurs
// de la mise à jour sont illisibles). Script autonome, réutilisable tel quel
// dans un autre projet Expo.
// Usage : npm run update:prod -- "message" [--platform android|ios|all]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

const PLATFORMS = ['android', 'ios', 'all'];
const SENTRY_PLUGINS = ['@sentry/react-native', '@sentry/react-native/expo'];

function fail(text) {
  console.error(`\n✖ ${text}`);
  process.exit(1);
}

// npx est un .cmd sous Windows : il doit passer par le shell.
const shell = process.platform === 'win32';

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit', shell }).status === 0;
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: { platform: { type: 'string', default: 'android' } },
  });
} catch (error) {
  fail(error.message);
}
const message = parsed.positionals.join(' ').trim();
const { platform } = parsed.values;

if (!message) fail('Message requis : npm run update:prod -- "description de la mise à jour"');
if (message.includes('"')) fail('Le message ne doit pas contenir de guillemets doubles.');
if (!PLATFORMS.includes(platform))
  fail(`Plateforme inconnue « ${platform} » : ${PLATFORMS.join(', ')}.`);

// Les jetons (Sentry, éventuellement EXPO_TOKEN) viennent de `.env` (jamais versionné).
if (existsSync('.env')) process.loadEnvFile('.env');

// La mise à jour embarque l'arbre de travail : il doit correspondre à un commit.
const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
if (status.status !== 0) fail('Impossible de lire l’état git.');
if (status.stdout.trim()) fail('Modifications non commitées : commit ou stash avant de publier.');

// Config résolue par Expo : couvre app.json comme app.config.js / app.config.ts.
const config = spawnSync('npx', ['expo', 'config', '--json'], { encoding: 'utf8', shell });
if (config.status !== 0) fail('Impossible de lire la configuration Expo (npx expo config).');
let plugins;
try {
  plugins = JSON.parse(config.stdout).plugins ?? [];
} catch {
  fail('Configuration Expo illisible (sortie de npx expo config non JSON).');
}

// `sentry-expo-upload-sourcemaps` ne lit que le plugin `@sentry/react-native/expo` ; un projet
// peut déclarer `@sentry/react-native` (le renommer changerait le fingerprint, donc le runtime).
// Organisation, projet et URL lui sont donc passés par l'environnement.
const sentryPlugin = plugins.find((p) => SENTRY_PLUGINS.includes(Array.isArray(p) ? p[0] : p));
const sentry = Array.isArray(sentryPlugin) ? (sentryPlugin[1] ?? {}) : {};
if (sentryPlugin) {
  if (!process.env.SENTRY_AUTH_TOKEN)
    fail('SENTRY_AUTH_TOKEN absent de .env : source maps impossibles à envoyer.');
  process.env.SENTRY_ORG ??= sentry.organization;
  process.env.SENTRY_PROJECT ??= sentry.project;
  if (sentry.url) process.env.SENTRY_URL ??= sentry.url;
  if (!process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT)
    fail('Plugin Sentry sans organization ni project (config Expo ou SENTRY_ORG / SENTRY_PROJECT).');
}

const published = run('npx', [
  'eas-cli@latest',
  'update',
  '--channel',
  'production',
  '--environment',
  'production',
  '--platform',
  platform,
  '--message',
  shell ? `"${message}"` : message,
  '--non-interactive',
]);
if (!published) fail('Échec de la publication EAS Update.');

if (!sentryPlugin) {
  console.log('\n✔ Mise à jour publiée (pas de plugin Sentry : source maps non envoyées).');
  process.exit(0);
}

if (!run('npx', ['sentry-expo-upload-sourcemaps', 'dist'])) {
  fail(
    'Mise à jour publiée, mais échec de l’envoi des source maps : relancer « npx sentry-expo-upload-sourcemaps dist ».',
  );
}

console.log('\n✔ Mise à jour publiée et source maps envoyées à Sentry.');
