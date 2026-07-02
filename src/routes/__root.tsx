import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

import { Toaster } from '@/components/ui/sonner';
import { ActiveThemeProvider } from '@/components/themes/active-theme';
import ThemeProvider from '@/components/themes/theme-provider';
import { DEFAULT_THEME, THEMES } from '@/components/themes/theme.config';
import { baseConfig } from '@/config';

import appCss from '@/styles/globals.css?url';

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
};

function getInitialTheme() {
  try {
    const t = localStorage.getItem('active_theme');
    if (t && THEMES.some((theme) => theme.value === t)) return t;
  } catch {}
  return DEFAULT_THEME;
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: baseConfig.projectName },
      {
        name: 'description',
        content: '后台管理框架与基础设施工作台'
      }
    ],
    links: [{ rel: 'stylesheet', href: appCss }]
  }),
  component: RootDocument
});

function RootDocument() {
  const initialTheme = getInitialTheme();

  return (
    <>
      <HeadContent />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            try {
              if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
              }
            } catch (_) {}
          `
        }}
      />
      <ThemeProvider
        attribute='class'
        defaultTheme='system'
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        <ActiveThemeProvider initialTheme={initialTheme}>
          <Toaster />
          <Outlet />
        </ActiveThemeProvider>
      </ThemeProvider>
      <TanStackRouterDevtools position='bottom-left' />
    </>
  );
}
