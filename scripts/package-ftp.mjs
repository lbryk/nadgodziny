#!/usr/bin/env node
/**
 * Builds the "upload over FTP" bundle for ordinary PHP hosting (no Node, no Docker):
 *
 *   release-ftp/nadgodziny-ftp/
 *     index.html, assets/, ocr/, pdfjs/, ...   static client (relative URLs, hash routes)
 *     config.js                                 runtime switch: api via ?r=, hash router
 *     api/                                      PHP backend (+ .htaccess, data/)
 *     CZYTAJ-MNIE.txt                           upload instructions
 *
 * Run `npm run package:ftp` (builds the client in --mode ftp first).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release-ftp');
const dir = path.join(out, 'nadgodziny-ftp');
const webDist = path.join(root, 'apps/web/dist-ftp');
if (!existsSync(webDist))
  throw new Error('Brak apps/web/dist-ftp — uruchom "npm run package:ftp".');

rmSync(out, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
cpSync(webDist, dir, { recursive: true });
cpSync(path.join(root, 'server-php/api'), path.join(dir, 'api'), {
  recursive: true,
  filter: (src) => !/[\\/]api[\\/]data[\\/](store\.php|\.lock|rate-.*)$/.test(src),
});
writeFileSync(
  path.join(dir, 'config.js'),
  "window.__NADGODZINY__ = { api: 'query', router: 'hash' };\n",
);
// Static hosting niceties for the client: no stale index.html, long cache for hashed assets.
writeFileSync(
  path.join(dir, '.htaccess'),
  `# Nadgodziny — ustawienia Apache dla części statycznej
DirectoryIndex index.html
<IfModule mod_headers.c>
  <FilesMatch "^(index\\.html|config\\.js)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(js|css|woff2|png|svg|wasm|traineddata|gz)$">
    Header set Cache-Control "public, max-age=31536000"
  </FilesMatch>
</IfModule>
<IfModule mod_mime.c>
  AddType application/wasm .wasm
  AddType text/javascript .mjs
</IfModule>
`,
);
cpSync(path.join(root, 'server-php/CZYTAJ-MNIE.txt'), path.join(dir, 'CZYTAJ-MNIE.txt'));

const zip = path.join(out, 'nadgodziny-ftp.zip');
try {
  execFileSync('zip', ['-qr', zip, 'nadgodziny-ftp'], { cwd: out, stdio: 'inherit' });
  console.log('Gotowe:', zip);
} catch {
  console.log('Brak programu zip — spakuj ręcznie folder', dir);
}
