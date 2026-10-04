#!/usr/bin/env node
/**
 * Builds a self-contained release folder (and archive) that can be uploaded to any server with Node 20+:
 *
 *   release/nadgodziny/
 *     server/index.js   bundled API + static host (domain package included)
 *     web/              built client (incl. self-hosted OCR assets)
 *     package.json      runtime dependencies only  ->  `npm install --omit=dev`
 *     .env.example, start.sh, ecosystem.config.cjs, nadgodziny.service, nginx.conf.example
 *
 * Run `npm run package` (it builds first).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release');
const dir = path.join(out, 'nadgodziny');

const serverDist = path.join(root, 'apps/server/dist');
const webDist = path.join(root, 'apps/web/dist');
for (const p of [serverDist, webDist]) {
  if (!existsSync(p)) throw new Error(`Missing ${p} — run "npm run build" first.`);
}

const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const serverPkg = JSON.parse(readFileSync(path.join(root, 'apps/server/package.json'), 'utf8'));
const { '@nadgodziny/core': _core, ...dependencies } = serverPkg.dependencies;

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(dir, 'server'), { recursive: true });
cpSync(path.join(serverDist, 'index.js'), path.join(dir, 'server/index.js'));
cpSync(webDist, path.join(dir, 'web'), { recursive: true });
cpSync(path.join(root, '.env.example'), path.join(dir, '.env.example'));
for (const file of [
  'ecosystem.config.cjs',
  'nadgodziny.service',
  'nginx.conf.example',
  'WDROZENIE.txt',
]) {
  cpSync(path.join(root, 'deploy', file), path.join(dir, file));
}

writeFileSync(
  path.join(dir, 'package.json'),
  JSON.stringify(
    {
      name: 'nadgodziny-release',
      version: rootPkg.version,
      private: true,
      type: 'module',
      engines: rootPkg.engines,
      scripts: { start: 'node server/index.js' },
      dependencies,
    },
    null,
    2,
  ) + '\n',
);

writeFileSync(
  path.join(dir, 'start.sh'),
  `#!/usr/bin/env sh
# Loads .env (if present) and starts the server.
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export NODE_ENV=production
exec node server/index.js
`,
  { mode: 0o755 },
);

const stamp = rootPkg.version;
try {
  execFileSync(
    'tar',
    ['-czf', path.join(out, `nadgodziny-${stamp}.tar.gz`), '-C', out, 'nadgodziny'],
    { stdio: 'inherit' },
  );
  console.log(`Created release/nadgodziny-${stamp}.tar.gz`);
} catch {
  console.warn('tar not available — upload the release/nadgodziny folder as it is.');
}
try {
  execFileSync('zip', ['-qr', path.join(out, `nadgodziny-${stamp}.zip`), 'nadgodziny'], {
    cwd: out,
    stdio: 'inherit',
  });
  console.log(`Created release/nadgodziny-${stamp}.zip`);
} catch {
  /* zip is optional */
}
console.log('Folder: release/nadgodziny — on the server run: npm install --omit=dev && ./start.sh');
