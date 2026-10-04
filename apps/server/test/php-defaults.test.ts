import { readFileSync } from 'node:fs';
import { DEFAULT_CUSTOM_DAYS, DEFAULT_SETTINGS } from '@nadgodziny/core';
import { describe, expect, it } from 'vitest';

describe('wersja PHP (FTP)', () => {
  it('ma te same ustawienia domyślne co serwer Node', () => {
    const file = new URL('../../../server-php/api/defaults.json', import.meta.url);
    const php = JSON.parse(readFileSync(file, 'utf8'));
    expect(php).toEqual(
      JSON.parse(JSON.stringify({ settings: DEFAULT_SETTINGS, customDays: DEFAULT_CUSTOM_DAYS })),
    );
  });
});
