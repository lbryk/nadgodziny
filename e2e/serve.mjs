// Starts the built server on a temporary data directory (used by Playwright).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT ?? '3100';
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'nadgodziny-e2e-'));
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'e2e-admin-password-1';
process.env.LOG_LEVEL = 'warn';
process.env.LOGIN_RATE_LIMIT = '200'; // every spec logs in; the limit itself is covered by the server tests

await import('../apps/server/dist/index.js');
