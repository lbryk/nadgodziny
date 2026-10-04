import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const bool = z
  .enum(['1', '0', 'true', 'false', 'yes', 'no', ''])
  .transform((v) => v === '1' || v === 'true' || v === 'yes');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().default('./data'),
  WEB_DIST: z.string().optional(),
  ADMIN_USER: z.string().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_PASSWORD_RESET: bool.default(false),
  JWT_SECRET: z.string().min(16).optional(),
  /** Login attempts allowed per minute and IP address. */
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(8),
  SESSION_HOURS: z.coerce.number().min(1).max(168).default(8),
  /** Set to 1 when the site is served over HTTPS (recommended in production). */
  COOKIE_SECURE: bool.optional(),
  /** Set to 1 behind a reverse proxy (nginx, Traefik …) so client IPs are read from X-Forwarded-For. */
  TRUST_PROXY: bool.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = Omit<z.infer<typeof schema>, 'COOKIE_SECURE'> & {
  COOKIE_SECURE: boolean;
  webDist: string | null;
  dataDir: string;
};

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  // monorepo build (apps/server/dist -> apps/web/dist) or release package (server/ next to web/)
  const candidates = [path.resolve(here, '../web'), path.resolve(here, '../../web/dist')];
  const defaultDist =
    candidates.find((dir) => existsSync(path.join(dir, 'index.html'))) ?? candidates[1]!;
  return {
    ...parsed,
    COOKIE_SECURE: parsed.COOKIE_SECURE ?? false,
    webDist: parsed.WEB_DIST ? path.resolve(parsed.WEB_DIST) : defaultDist,
    dataDir: path.resolve(parsed.DATA_DIR),
  };
}
