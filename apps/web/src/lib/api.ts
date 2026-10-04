import type { CustomDay, Settings } from '@nadgodziny/core';

export interface PublicConfig {
  settings: Settings;
  customDays: CustomDay[];
  revision: number;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  if (!res.ok) {
    let message = `Błąd serwera (${res.status})`;
    let issues: unknown;
    try {
      const body = (await res.json()) as { error?: string; issues?: unknown };
      if (body.error) message = body.error;
      issues = body.issues;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status, issues);
  }
  if (res.status === 204 || res.status === 304) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  config: () => request<PublicConfig>('/api/config'),
  session: () => request<{ user: string }>('/api/admin/session'),
  login: (username: string, password: string) =>
    request<{ user: string }>('/api/admin/login', { method: 'POST', json: { username, password } }),
  logout: () => request<{ ok: true }>('/api/admin/logout', { method: 'POST' }),
  saveSettings: (settings: Settings) =>
    request<PublicConfig>('/api/admin/settings', { method: 'PUT', json: settings }),
  saveCalendar: (customDays: CustomDay[]) =>
    request<PublicConfig>('/api/admin/calendar', { method: 'PUT', json: { customDays } }),
  changePassword: (current: string, next: string) =>
    request<{ ok: true }>('/api/admin/password', { method: 'POST', json: { current, next } }),
  restore: (payload: { settings: Settings; customDays: CustomDay[] }) =>
    request<PublicConfig>('/api/admin/restore', { method: 'POST', json: payload }),
  calendarXml: () => request<string>('/api/admin/calendar.xml'),
};
