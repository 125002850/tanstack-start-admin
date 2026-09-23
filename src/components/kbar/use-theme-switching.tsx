import { useRegisterActions } from 'kbar';
import { useThemeMode } from '@/components/themes/use-theme-mode';
import { useThemeConfig } from '@/components/themes/active-theme';
import { THEMES } from '@/components/themes/theme.config';

const useThemeSwitching = () => {
  const { setTheme, toggleThemeMode } = useThemeMode();
  const { activeTheme, setActiveTheme } = useThemeConfig();

  const cycleTheme = () => {
    const currentIndex = THEMES.findIndex((t) => t.value === activeTheme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    setActiveTheme(THEMES[nextIndex].value);
  };

  const themeActions = [
    {
      id: 'cycleTheme',
      name: '切换主题',
      shortcut: ['t', 't'],
      section: '主题',
      perform: cycleTheme
    },
    {
      id: 'toggleDarkLight',
      name: '切换明暗模式',
      shortcut: ['d', 'd'],
      section: '主题',
      perform: toggleThemeMode
    },
    {
      id: 'setLightTheme',
      name: '切换为浅色模式',
      section: '主题',
      perform: () => setTheme('light')
    },
    {
      id: 'setDarkTheme',
      name: '切换为深色模式',
      section: '主题',
      perform: () => setTheme('dark')
    },
    {
      id: 'setSystemTheme',
      name: '跟随系统明暗模式',
      section: '主题',
      perform: () => setTheme('system')
    }
  ];

  useRegisterActions(themeActions, [toggleThemeMode, setTheme, activeTheme, setActiveTheme]);
};

export default useThemeSwitching;
