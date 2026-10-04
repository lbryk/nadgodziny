#!/usr/bin/env node
/**
 * Rasterises the SVG icons into the PNG/ICO set browsers and phones look for.
 * Needs Playwright's Chromium (`npx playwright install chromium`); the output is committed.
 *
 *   node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'apps/web/public');
const svg = readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
const maskable = readFileSync(path.join(pub, 'icon-maskable.svg'), 'utf8');

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

async function png(source, size, { background } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:${background ?? 'transparent'}}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  return page.screenshot({
    type: 'png',
    omitBackground: !background,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

/** ICO container with PNG-compressed images (supported since Windows Vista and by every browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const write = (name, data) => {
  writeFileSync(path.join(pub, name), data);
  console.log(`${name}  ${data.length} B`);
};

const sizes = [16, 32, 48];
const rendered = await Promise.all(
  sizes.map(async (size) => ({ size, data: await png(svg, size) })),
);
write('favicon.ico', ico(rendered));
write('favicon-16.png', rendered[0].data);
write('favicon-32.png', rendered[1].data);
// iOS draws its own rounded corners and dislikes transparency: full-bleed square
write('apple-touch-icon.png', await png(maskable, 180));
write('icon-192.png', await png(svg, 192));
write('icon-512.png', await png(svg, 512));
write('icon-maskable-512.png', await png(maskable, 512));

await browser.close();
