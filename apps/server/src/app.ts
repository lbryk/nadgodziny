import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyCompress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { buildCalendarXml, customDaysSchema, settingsSchema } from '@nadgodziny/core';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Config } from './config';
import { constantTimeEqual, hashPassword, randomSecret, verifyPassword } from './password';
import type { Store } from './store';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

const COOKIE_NAME = 'nadgodziny_admin';
// Only used to burn the same CPU time when the user name is wrong (no user enumeration by timing).
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const loginBody = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });
const passwordBody = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10, 'Hasło musi mieć co najmniej 10 znaków.').max(200),
});
const calendarBody = z.object({ customDays: customDaysSchema });
const backupBody = z.object({ settings: settingsSchema, customDays: customDaysSchema });

export interface BuildAppOptions {
  config: Config;
  store: Store;
}

export async function buildApp({ config, store }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.LOG_LEVEL },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 2 * 1024 * 1024,
  });

  await ensureAdmin(config, store, app);

  let jwtSecret = config.JWT_SECRET ?? store.snapshot.jwtSecret;
  if (!jwtSecret) {
    jwtSecret = randomSecret(48);
    const secret = jwtSecret;
    await store.update((s) => void (s.jwtSecret = secret), { bump: false });
  }

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // tesseract.js compiles WebAssembly and spawns a worker for OCR
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        workerSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'blob:', 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(fastifyCompress, { global: true });
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, { global: false });
  await app.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: { cookieName: COOKIE_NAME, signed: false },
    sign: { expiresIn: `${config.SESSION_HOURS}h` },
  });

  /* -------------------------------------------------------------------------------------- */

  app.get('/api/health', async () => ({ status: 'ok', revision: store.snapshot.revision }));

  app.get('/api/config', async (request, reply) => {
    const config = store.publicConfig;
    const etag = `W/"cfg-${config.revision}"`;
    reply.header('ETag', etag).header('Cache-Control', 'no-cache');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return config;
  });

  /* --- Admin ---------------------------------------------------------------------------- */

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify({ onlyCookie: true });
    } catch {
      return reply.code(401).send({ error: 'Wymagane logowanie administratora.' });
    }
    return undefined;
  };

  // Mutating admin requests must come from this very site (CSRF defence on top of SameSite=Strict).
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/admin') || request.method === 'GET') return;
    const origin = request.headers.origin;
    if (!origin) return;
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return reply.code(403).send({ error: 'Niedozwolone źródło żądania.' });
    }
    if (host !== request.headers.host) {
      return reply.code(403).send({ error: 'Niedozwolone źródło żądania.' });
    }
    return undefined;
  });

  app.post(
    '/api/admin/login',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = loginBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'Podaj login i hasło.' });
      const admin = store.snapshot.admin;
      const userOk = admin ? constantTimeEqual(body.data.username, admin.user) : false;
      const passOk = await verifyPassword(body.data.password, admin?.passwordHash ?? DUMMY_HASH);
      if (!admin || !userOk || !passOk) {
        request.log.warn({ ip: request.ip }, 'failed admin login');
        return reply.code(401).send({ error: 'Nieprawidłowy login lub hasło.' });
      }
      const token = app.jwt.sign({ sub: admin.user });
      reply.setCookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.COOKIE_SECURE,
        path: '/',
        maxAge: config.SESSION_HOURS * 3600,
      });
      return { user: admin.user };
    },
  );

  app.post('/api/admin/logout', async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  app.get('/api/admin/session', { preHandler: requireAdmin }, async (request) => ({
    user: request.user.sub,
  }));

  app.put('/api/admin/settings', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Niepoprawne ustawienia.', issues: parsed.error.issues });
    await store.update((s) => void (s.settings = parsed.data));
    return store.publicConfig;
  });

  app.put('/api/admin/calendar', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = calendarBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Niepoprawny kalendarz.', issues: parsed.error.issues });
    const byDate = new Map(parsed.data.customDays.map((d) => [d.date, d]));
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    await store.update((s) => void (s.customDays = days));
    return store.publicConfig;
  });

  app.post('/api/admin/password', { preHandler: requireAdmin, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = passwordBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Niepoprawne dane.' });
    }
    const admin = store.snapshot.admin;
    if (!admin || !(await verifyPassword(body.data.current, admin.passwordHash))) {
      return reply.code(403).send({ error: 'Aktualne hasło jest nieprawidłowe.' });
    }
    const passwordHash = await hashPassword(body.data.next);
    await store.update((s) => void (s.admin = { user: admin.user, passwordHash, source: 'ui' }), { bump: false });
    return { ok: true };
  });

  app.get('/api/admin/backup', { preHandler: requireAdmin }, async (_request, reply) => {
    const { settings, customDays } = store.publicConfig;
    reply.header('Content-Disposition', 'attachment; filename="nadgodziny-konfiguracja.json"');
    return { settings, customDays };
  });

  app.post('/api/admin/restore', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = backupBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Plik kopii zapasowej jest niepoprawny.' });
    await store.update((s) => {
      s.settings = parsed.data.settings;
      s.customDays = parsed.data.customDays;
    });
    return store.publicConfig;
  });

  app.get('/api/admin/calendar.xml', { preHandler: requireAdmin }, async (_request, reply) => {
    const { settings, customDays } = store.publicConfig;
    reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="kalendarz.xml"');
    return buildCalendarXml(customDays, `${settings.schoolYearStart}/${settings.schoolYearStart + 1}`);
  });

  /* --- Static web client ---------------------------------------------------------------- */

  if (config.webDist && existsSync(path.join(config.webDist, 'index.html'))) {
    const dist = config.webDist;
    await app.register(fastifyStatic, {
      root: dist,
      wildcard: false,
      setHeaders(reply, filePath) {
        // Hashed build assets can be cached forever; everything else must revalidate.
        if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}tesseract${path.sep}`)) {
          reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          reply.header('Cache-Control', 'no-cache');
        }
      },
    });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/') && request.headers.accept?.includes('text/html')) {
        return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Nie znaleziono.' });
    });
  } else {
    app.log.warn('Web client build not found — only the API is served.');
  }

  return app;
}

/** Creates the administrator on first start, or follows ADMIN_PASSWORD while it is still the source. */
async function ensureAdmin(config: Config, store: Store, app: FastifyInstance): Promise<void> {
  const current = store.snapshot.admin;
  const envPassword = config.ADMIN_PASSWORD;

  if (!current) {
    let password = envPassword;
    let generated = false;
    if (!password) {
      if (config.NODE_ENV === 'production') {
        password = randomSecret(12);
        generated = true;
      } else {
        password = 'admin12345';
        app.log.warn('Development admin account: %s / %s', config.ADMIN_USER, password);
      }
    }
    const passwordHash = await hashPassword(password);
    await store.update(
      (s) => void (s.admin = { user: config.ADMIN_USER, passwordHash, source: envPassword ? 'env' : 'ui' }),
      { bump: false },
    );
    if (generated) {
      app.log.warn(
        '\n==============================================================\n' +
          ` ADMIN_PASSWORD was not set. Generated one-time password:\n   ${config.ADMIN_USER} / ${password}\n` +
          ' Log in at /admin and change it immediately.\n' +
          '==============================================================',
      );
    }
    return;
  }

  const followEnv = envPassword && (current.source === 'env' || config.ADMIN_PASSWORD_RESET);
  const userChanged = current.user !== config.ADMIN_USER && current.source === 'env';
  if (followEnv && (userChanged || !(await verifyPassword(envPassword, current.passwordHash)))) {
    const passwordHash = await hashPassword(envPassword);
    await store.update((s) => void (s.admin = { user: config.ADMIN_USER, passwordHash, source: 'env' }), {
      bump: false,
    });
    app.log.info('Administrator credentials were refreshed from the environment.');
  }
}
