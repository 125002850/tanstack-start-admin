import {
  ReactNode,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { DEFAULT_THEME, THEMES } from './theme.config';

const STORAGE_KEY = 'active_theme';

function persistTheme(theme: string) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 存储不可用时，仍允许当前页面切换主题。
  }
}

type ThemeContextType = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme
}: {
  children: ReactNode;
  initialTheme?: string;
}) {
  const themeToUse = initialTheme || DEFAULT_THEME;
  const [activeTheme, setActiveThemeState] = useState<string>(themeToUse);
  const setActiveTheme = useCallback((theme: string) => {
    setActiveThemeState(theme);
    persistTheme(theme);
  }, []);
  const themeContextValue = useMemo(
    () => ({ activeTheme, setActiveTheme }),
    [activeTheme, setActiveTheme]
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== localStorage) return;
        // 读取最新值，避免排队中的旧事件覆盖较新的主题；同步时不写回存储。
        const theme = localStorage.getItem(STORAGE_KEY);
        setActiveThemeState(
          theme && THEMES.some((item) => item.value === theme) ? theme : DEFAULT_THEME
        );
      } catch {
        // 无法读取时保留当前主题。
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    // Only update if theme has changed
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme !== activeTheme) {
      // Remove existing data-theme attribute
      document.documentElement.removeAttribute('data-theme');

      // Remove any theme classes from body (cleanup)
      Array.from(document.body.classList)
        .filter((className) => className.startsWith('theme-'))
        .forEach((className) => {
          document.body.classList.remove(className);
        });

      // Set data-theme on html element
      if (activeTheme) {
        document.documentElement.setAttribute('data-theme', activeTheme);
      }
    }
  }, [activeTheme]);

  return <ThemeContext.Provider value={themeContextValue}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeConfig must be used within an ActiveThemeProvider');
  }
  return context;
}

export function useOptionalThemeConfig() {
  return useContext(ThemeContext);
}
