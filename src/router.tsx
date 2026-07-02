import {
  createRouter as createTanStackRouter,
  type ErrorComponentProps
} from '@tanstack/react-router';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';
import { Icons } from '@/components/icons';
import { DefaultErrorPage } from '@/components/layout/default-error-page';
import { getQueryClient } from '@/lib/query-client';
import { hydrateFromUrl } from '@/lib/api/sso/session';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { routeTree } from './routeTree.gen';

const DEFAULT_PENDING_MS = 2500;

function getRouterBasepath(): string | undefined {
  const baseUrl = import.meta.env.BASE_URL;

  if (!baseUrl || baseUrl === '/' || baseUrl === './') {
    return undefined;
  }

  const pathname = baseUrl.startsWith('http') ? new URL(baseUrl).pathname : baseUrl;
  const normalized = `/${pathname.replace(/^\/+|\/+$/g, '')}`;

  return normalized === '/' ? undefined : normalized;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '页面加载时遇到未知异常。';
}

function DefaultRouterErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <DefaultErrorPage
      code='500'
      title='系统异常'
      description='页面加载时遇到异常，当前操作未能继续。'
      alertTitle='运行异常'
      alertDescription={getErrorMessage(error)}
      action={{
        label: '重试',
        icon: Icons.rotateClockwise,
        onClick: reset
      }}
    />
  );
}

function DefaultRouterNotFoundComponent() {
  return (
    <DefaultErrorPage
      code='404'
      title='页面不存在'
      description='访问的页面不存在或已被移动。'
      alertTitle='路由未匹配'
      alertDescription='请检查地址是否正确，或返回工作台继续操作。'
      action={{
        label: '返回工作台',
        icon: Icons.arrowRight,
        href: resolveDashboardHomeHref()
      }}
    />
  );
}

export function createRouter() {
  hydrateFromUrl();

  const queryClient = getQueryClient();
  const basepath = getRouterBasepath();

  const router = createTanStackRouter({
    routeTree,
    ...(basepath ? { basepath } : {}),
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: DEFAULT_PENDING_MS,
    context: { queryClient },
    defaultErrorComponent: DefaultRouterErrorComponent,
    defaultNotFoundComponent: DefaultRouterNotFoundComponent
  });

  return routerWithQueryClient(router, queryClient);
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
