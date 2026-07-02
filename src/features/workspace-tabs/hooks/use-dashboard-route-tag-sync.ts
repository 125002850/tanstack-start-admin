import { useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { getAppRouteStaticData, type AppRouteStaticData } from '@/lib/router/app-route-meta';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { resolveRouteWorkspaceConfig, resolveRouteTagTitle } from '../lib/route-workspace';
import type { WorkspaceTabId } from '../types';
import { useWorkspaceTabStore } from '../utils/store';

function tagIdFromPathname(pathname: string): WorkspaceTabId {
  return normalizeRoutePath(pathname);
}

export function normalizeRoutePath(path: string): string {
  if (path.length <= 1) return path;
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Convert a TanStack Router route path (e.g. "/dashboard/items/$itemId")
 * into a regex for matching against actual pathnames (e.g. "/dashboard/items/123").
 */
function compileRoutePattern(routePath: string): RegExp {
  const normalizedRoutePath = normalizeRoutePath(routePath);
  let escaped = '';
  for (let i = 0; i < normalizedRoutePath.length; i++) {
    if (
      normalizedRoutePath[i] === '$' &&
      i + 1 < normalizedRoutePath.length &&
      normalizedRoutePath[i + 1] !== '/'
    ) {
      escaped += '[^/]+';
      while (i + 1 < normalizedRoutePath.length && normalizedRoutePath[i + 1] !== '/') {
        i++;
      }
    } else {
      const c = normalizedRoutePath[i];
      if (
        c === '.' ||
        c === '+' ||
        c === '*' ||
        c === '?' ||
        c === '^' ||
        c === '(' ||
        c === ')' ||
        c === '[' ||
        c === ']' ||
        c === '{' ||
        c === '}' ||
        c === '|' ||
        c === '\\'
      ) {
        escaped += '\\' + c;
      } else {
        escaped += c;
      }
    }
  }
  return new RegExp(`^${escaped}$`);
}

export interface DeepestRouteMatch {
  staticData: AppRouteStaticData;
  pattern: string;
}

type CompiledRouteMatcher = DeepestRouteMatch & {
  regex: RegExp;
  segmentCount: number;
};

type RouteStaticDataCarrier = {
  options?: { staticData?: unknown };
  staticData?: unknown;
};

const routeMatcherCache = new WeakMap<object, CompiledRouteMatcher[]>();

function getCompiledRouteMatchers(routesByPath: Record<string, unknown>): CompiledRouteMatcher[] {
  const cached = routeMatcherCache.get(routesByPath);
  if (cached) return cached;

  const matchers: CompiledRouteMatcher[] = [];
  for (const [pattern, route] of Object.entries(routesByPath)) {
    if (typeof route !== 'object' || route === null) continue;

    const staticData = getAppRouteStaticData(route as RouteStaticDataCarrier);
    if (!staticData) continue;

    const normalizedPattern = normalizeRoutePath(pattern);
    matchers.push({
      staticData,
      pattern,
      regex: compileRoutePattern(normalizedPattern),
      segmentCount: normalizedPattern.split('/').length
    });
  }

  matchers.sort((a, b) => b.segmentCount - a.segmentCount);
  routeMatcherCache.set(routesByPath, matchers);
  return matchers;
}

/**
 * Find the deepest matching route for a given pathname by converting
 * route patterns with $param placeholders into regexes.
 */
export function findDeepestRouteMatch(
  pathname: string,
  routesByPath: Record<string, unknown>
): DeepestRouteMatch | undefined {
  const normalizedPathname = normalizeRoutePath(pathname);
  for (const matcher of getCompiledRouteMatchers(routesByPath)) {
    if (matcher.regex.test(normalizedPathname)) {
      return { staticData: matcher.staticData, pattern: matcher.pattern };
    }
  }
  return undefined;
}

export function useDashboardRouteTagSync(enabled = true) {
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const prevHref = useRef<string | null>(null);
  const prevEnabled = useRef(enabled);
  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect;

  useIsomorphicLayoutEffect(() => {
    if (!enabled && prevEnabled.current) {
      useWorkspaceTabStore.getState().resetAll();
      prevHref.current = null;
    }

    prevEnabled.current = enabled;
  }, [enabled]);

  // Seed the home tag once on mount (idempotent via store check)
  useIsomorphicLayoutEffect(() => {
    if (!enabled) return;

    const homeHref = resolveDashboardHomeHref();
    const store = useWorkspaceTabStore.getState();
    if (!store.tabs[tagIdFromPathname(homeHref)]) {
      store.openOrActivate({
        id: tagIdFromPathname(homeHref),
        href: homeHref,
        title: '仪表盘',
        closable: false,
        keepAlive: false
      });
    }
  }, [enabled]);

  useIsomorphicLayoutEffect(() => {
    if (!enabled) return;

    const pathname = location.pathname;
    const normalizedPathname = normalizeRoutePath(pathname);
    const searchStr = location.searchStr || '';
    const fullHref = normalizedPathname + searchStr;
    const clearActiveWorkspaceRoute = () => {
      if (useWorkspaceTabStore.getState().activeId !== null) {
        useWorkspaceTabStore.setState({ activeId: null });
      }
    };

    if (fullHref === prevHref.current) return;
    prevHref.current = fullHref;

    // Only track dashboard sub-routes
    if (!normalizedPathname.startsWith('/dashboard')) {
      clearActiveWorkspaceRoute();
      return;
    }

    // Skip the layout route itself
    if (normalizedPathname === '/dashboard') {
      clearActiveWorkspaceRoute();
      return;
    }

    const match = findDeepestRouteMatch(
      normalizedPathname,
      router.routesByPath as unknown as Record<string, unknown>
    );

    const wsConfig = resolveRouteWorkspaceConfig(
      match?.pattern ?? normalizedPathname,
      match?.staticData
    );
    if (!wsConfig.tagEnabled) {
      clearActiveWorkspaceRoute();
      return;
    }

    const title = resolveRouteTagTitle(match?.staticData, normalizedPathname);
    const id = tagIdFromPathname(normalizedPathname);
    const closable = wsConfig.closable;

    useWorkspaceTabStore.getState().openOrActivate({
      id,
      href: fullHref,
      title: title || normalizedPathname,
      closable,
      keepAlive: wsConfig.keepAlive
    });
  }, [location.pathname, location.searchStr, router.routesByPath, enabled]);
}
