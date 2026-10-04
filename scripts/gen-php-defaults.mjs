#!/usr/bin/env node
/**
 * Writes server-php/api/defaults.json from the domain package, so the PHP edition
 * starts with exactly the same settings and calendar as the Node server.
 * Run with: npx tsx scripts/gen-php-defaults.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CUSTOM_DAYS, DEFAULT_SETTINGS } from '../packages/core/src/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'server-php/api/defaults.json');
const json = JSON.stringify(
  { settings: DEFAULT_SETTINGS, customDays: DEFAULT_CUSTOM_DAYS },
  null,
  2,
);
if (process.argv.includes('--check')) {
  const { readFileSync } = await import('node:fs');
  if (readFileSync(file, 'utf8') !== json + '\n') {
    console.error('server-php/api/defaults.json is stale — run: npm run gen:php-defaults');
    process.exit(1);
  }
} else {
  writeFileSync(file, json + '\n');
  console.log('wrote', file);
}
