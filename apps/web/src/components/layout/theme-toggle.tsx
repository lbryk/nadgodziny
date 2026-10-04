import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '../../state/theme-store';
import { Segmented } from '../ui/segmented';

const options = [
  { value: 'light' as const, label: <Sun className="size-4" />, hint: 'Jasny' },
  { value: 'system' as const, label: <Monitor className="size-4" />, hint: 'Systemowy' },
  { value: 'dark' as const, label: <Moon className="size-4" />, hint: 'Ciemny' },
];

export function ThemeToggle() {
  const { preference, setPreference } = useThemeStore();
  return (
    <Segmented<ThemePreference>
      aria-label="Motyw kolorystyczny"
      value={preference}
      onChange={setPreference}
      options={options}
      size="sm"
      className="[&_button]:px-2"
    />
  );
}
