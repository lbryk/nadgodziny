import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_SETTINGS, DEFAULT_CUSTOM_DAYS } from '@nadgodziny/core';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { Store } from '../src/store';

let dir: string;
let app: FastifyInstance;
let store: Store;

const env = (extra: Record<string, string> = {}) =>
  loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: dir,
    ADMIN_PASSWORD: 'correct-horse-battery',
    WEB_DIST: path.join(dir, 'none'),
    ...extra,
  });

async function start(extra: Record<string, string> = {}) {
  store = await Store.open(dir);
  app = await buildApp({ config: env(extra), store });
}

async function login(password = 'correct-horse-battery', username = 'admin') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { username, password },
  });
  const cookie = res.cookies.find((c) => c.name === 'nadgodziny_admin');
  return { res, cookie: cookie ? `${cookie.name}=${cookie.value}` : '' };
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'nadgodziny-'));
  await start();
});

afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe('public API', () => {
  it('reports health', async () => {
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('serves default settings and school days without any login', async () => {
    const res = await app.inject('/api/config');
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.settings.weights).toEqual(DEFAULT_SETTINGS.weights);
    expect(body.customDays).toHaveLength(DEFAULT_CUSTOM_DAYS.length);
    expect(res.headers.etag).toBeTruthy();
  });

  it('answers 304 for an unchanged revision', async () => {
    const first = await app.inject('/api/config');
    const again = await app.inject({
      url: '/api/config',
      headers: { 'if-none-match': String(first.headers.etag) },
    });
    expect(again.statusCode).toBe(304);
  });

  it('sends security headers', async () => {
    const res = await app.inject('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('admin authentication', () => {
  it('rejects wrong credentials', async () => {
    expect((await login('nope')).res.statusCode).toBe(401);
    expect((await login('correct-horse-battery', 'root')).res.statusCode).toBe(401);
  });

  it('logs in with an httpOnly SameSite=Strict cookie', async () => {
    const { res } = await login();
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'nadgodziny_admin')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
  });

  it('protects every admin route', async () => {
    for (const [method, url] of [
      ['GET', '/api/admin/session'],
      ['PUT', '/api/admin/settings'],
      ['PUT', '/api/admin/calendar'],
      ['POST', '/api/admin/password'],
      ['GET', '/api/admin/backup'],
    ] as const) {
      const res = await app.inject({ method, url, payload: method === 'GET' ? undefined : {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('knows the session after login and forgets it after logout', async () => {
    const { cookie } = await login();
    expect((await app.inject({ url: '/api/admin/session', headers: { cookie } })).json()).toEqual({
      user: 'admin',
    });
    const out = await app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie } });
    expect(out.cookies[0]?.value).toBe('');
  });

  it('rate-limits login attempts', async () => {
    let last = 0;
    for (let i = 0; i < 10; i += 1) last = (await login('bad')).res.statusCode;
    expect(last).toBe(429);
  });

  it('refuses cross-site mutations', async () => {
    const { cookie } = await login();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/calendar',
      headers: { cookie, origin: 'https://evil.example', host: 'nadgodziny.local' },
      payload: { customDays: [] },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('admin changes', () => {
  it('updates settings and bumps the revision', async () => {
    const { cookie } = await login();
    const before = (await app.inject('/api/config')).json().revision;
    const settings = {
      ...DEFAULT_SETTINGS,
      weeksPerMonth: 4.2,
      weights: { ...DEFAULT_SETTINGS.weights, k34: 0.91 },
    };
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie },
      payload: settings,
    });
    expect(res.statusCode).toBe(200);
    const after = (await app.inject('/api/config')).json();
    expect(after.settings.weights.k34).toBe(0.91);
    expect(after.revision).toBe(before + 1);
  });

  it('rejects invalid settings with details', async () => {
    const { cookie } = await login();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie },
      payload: { ...DEFAULT_SETTINGS, weeksPerMonth: 99 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.length).toBeGreaterThan(0);
  });

  it('replaces the school days, de-duplicating by date', async () => {
    const { cookie } = await login();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/calendar',
      headers: { cookie },
      payload: {
        customDays: [
          { date: '2026-11-02', kind: 'director', label: 'a' },
          { date: '2026-11-02', kind: 'other', label: 'b' },
          { date: '2026-10-30', kind: 'director' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().customDays).toEqual([
      { date: '2026-10-30', kind: 'director' },
      { date: '2026-11-02', kind: 'other', label: 'b' },
    ]);
  });

  it('rejects impossible dates', async () => {
    const { cookie } = await login();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/calendar',
      headers: { cookie },
      payload: { customDays: [{ date: '2027-02-30', kind: 'other' }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('exports the calendar as XML', async () => {
    const { cookie } = await login();
    const res = await app.inject({ url: '/api/admin/calendar.xml', headers: { cookie } });
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.body).toContain('<kalendarz');
  });

  it('changes the password and invalidates the old one', async () => {
    const { cookie } = await login();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/admin/password',
      headers: { cookie },
      payload: { current: 'wrong', next: 'a-much-longer-password' },
    });
    expect(bad.statusCode).toBe(403);
    const short = await app.inject({
      method: 'POST',
      url: '/api/admin/password',
      headers: { cookie },
      payload: { current: 'correct-horse-battery', next: 'short' },
    });
    expect(short.statusCode).toBe(400);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/admin/password',
      headers: { cookie },
      payload: { current: 'correct-horse-battery', next: 'a-much-longer-password' },
    });
    expect(ok.statusCode).toBe(200);
    expect((await login('correct-horse-battery')).res.statusCode).toBe(401);
    expect((await login('a-much-longer-password')).res.statusCode).toBe(200);
  });
});

describe('persistence', () => {
  it('keeps settings, days and password across a restart', async () => {
    const { cookie } = await login();
    await app.inject({
      method: 'PUT',
      url: '/api/admin/calendar',
      headers: { cookie },
      payload: { customDays: [{ date: '2026-11-02', kind: 'director' }] },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/password',
      headers: { cookie },
      payload: { current: 'correct-horse-battery', next: 'persisted-password-1' },
    });
    await app.close();
    await start({ ADMIN_PASSWORD: 'something-else-entirely' }); // ignored: password was changed in the UI
    expect((await app.inject('/api/config')).json().customDays).toEqual([
      { date: '2026-11-02', kind: 'director' },
    ]);
    expect((await login('persisted-password-1')).res.statusCode).toBe(200);
    const raw = JSON.parse(await readFile(path.join(dir, 'store.json'), 'utf8'));
    expect(raw.admin.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(JSON.stringify(raw)).not.toContain('persisted-password-1');
  });

  it('follows ADMIN_PASSWORD from the environment until it is changed in the UI', async () => {
    await app.close();
    await start({ ADMIN_PASSWORD: 'rotated-by-operator-1' });
    expect((await login('rotated-by-operator-1')).res.statusCode).toBe(200);
    expect((await login('correct-horse-battery')).res.statusCode).toBe(401);
  });
});
