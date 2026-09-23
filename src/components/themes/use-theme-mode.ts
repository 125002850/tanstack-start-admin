import { useCallback } from 'react';
import { useTheme } from 'next-themes';

export function useThemeMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const toggleThemeMode = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return { setTheme, toggleThemeMode };
}
