// Publie une mise à jour EAS Update sur le canal `production`, puis envoie
// les source maps du bundle à Sentry (sinon les erreurs de la mise à jour
// sont illisibles). Usage : npm run update:prod -- "message"
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const message = process.argv[2]?.trim();

function fail(text) {
  console.error(`\n✖ ${text}`);
  process.exit(1);
}

function run(command, args) {
  // npx est un .cmd sous Windows : il doit passer par le shell.
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

if (!message) fail('Message requis : npm run update:prod -- "description de la mise à jour"');
if (message.includes('"')) fail('Le message ne doit pas contenir de guillemets doubles.');

// Le jeton Sentry vient de `.env` (jamais versionné).
if (existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.SENTRY_AUTH_TOKEN)
  fail('SENTRY_AUTH_TOKEN absent de .env : source maps impossibles à envoyer.');

// La mise à jour embarque l'arbre de travail : il doit correspondre à un commit.
const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
if (status.status !== 0) fail('Impossible de lire l’état git.');
if (status.stdout.trim()) fail('Modifications non commitées : commit ou stash avant de publier.');

const published = run('npx', [
  'eas-cli@latest',
  'update',
  '--channel',
  'production',
  '--environment',
  'production',
  '--platform',
  'android',
  '--message',
  process.platform === 'win32' ? `"${message}"` : message,
  '--non-interactive',
]);
if (!published) fail('Échec de la publication EAS Update.');

if (!run('npx', ['sentry-expo-upload-sourcemaps', 'dist'])) {
  fail(
    'Mise à jour publiée, mais échec de l’envoi des source maps : relancer « npx sentry-expo-upload-sourcemaps dist ».',
  );
}

console.log('\n✔ Mise à jour publiée et source maps envoyées à Sentry.');
