import { create } from 'zustand';
import { safeStorage } from '../lib/safe-storage';

export type ThemePreference = 'light' | 'dark' | 'system';
const KEY = 'nadgodziny:theme';

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system')
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: ThemePreference) {
  document.documentElement.dataset.theme = resolve(pref);
}

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: (safeStorage.getItem(KEY) as ThemePreference | null) ?? 'system',
  setPreference: (preference) => {
    safeStorage.setItem(KEY, preference);
    applyTheme(preference);
    set({ preference });
  },
}));

// follow the OS while the preference is "system"
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().preference === 'system') applyTheme('system');
  });
}
