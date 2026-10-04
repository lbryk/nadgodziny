import { DEFAULT_CUSTOM_DAYS, DEFAULT_SETTINGS, customDaysSchema, settingsSchema } from '@nadgodziny/core';
import { useQuery } from '@tanstack/react-query';
import { api, type PublicConfig } from '../lib/api';
import { safeStorage } from '../lib/safe-storage';

const CACHE_KEY = 'nadgodziny:config:v1';

const FALLBACK: PublicConfig = {
  settings: DEFAULT_SETTINGS,
  customDays: DEFAULT_CUSTOM_DAYS,
  revision: 0,
  updatedAt: '',
};

function readCache(): PublicConfig | undefined {
  const raw = safeStorage.getItem(CACHE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as PublicConfig;
    const s = settingsSchema.safeParse(parsed.settings);
    const d = customDaysSchema.safeParse(parsed.customDays);
    if (s.success && d.success) return { ...parsed, settings: s.data, customDays: d.data };
  } catch {
    /* corrupted cache */
  }
  return undefined;
}

export const CONFIG_KEY = ['config'] as const;

/**
 * Settings + school days come from the server (administrator-controlled). The last good copy is
 * cached locally so the calculator keeps working on a flaky network or on static hosting.
 */
export function useConfig() {
  const query = useQuery({
    queryKey: CONFIG_KEY,
    queryFn: async () => {
      const config = await api.config();
      safeStorage.setItem(CACHE_KEY, JSON.stringify(config));
      return config;
    },
    initialData: readCache,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const data = query.data ?? FALLBACK;
  return {
    config: data,
    settings: data.settings,
    customDays: data.customDays,
    /** `server` = fresh from the API, `cached` = last known copy, `defaults` = bundled data only */
    source: query.isSuccess && !query.isError ? ('server' as const) : readCache() ? ('cached' as const) : ('defaults' as const),
    isLoading: query.isFetching && !query.isFetched,
  };
}

export function cacheConfig(config: PublicConfig) {
  safeStorage.setItem(CACHE_KEY, JSON.stringify(config));
}
