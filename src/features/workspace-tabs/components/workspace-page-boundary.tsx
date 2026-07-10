import * as React from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { findDeepestRouteMatch, normalizeRoutePath } from '../hooks/use-dashboard-route-tag-sync';
import { useWorkspaceTabStore } from '../utils/store';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';
import { resolveRouteTagTitle, resolveRouteWorkspaceConfig } from '../lib/route-workspace';
import type { ResolvedMenuNode } from '@/lib/router/menu-tree-resolver';
import type { WorkspacePageBoundaryProps, WorkspacePageDescriptor } from '../types';

export function WorkspacePageBoundary({
  tabId,
  initialTitle,
  keepAlive: legacyKeepAlive,
  closable: legacyClosable,
  render,
  renderWhenDisabled,
  errorFallback,
  treeLookup
}: WorkspacePageBoundaryProps & { treeLookup?: Map<string, ResolvedMenuNode> }) {
  const enabled = isWorkspaceTabsEnabled();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const normalizedPathname = normalizeRoutePath(pathname);
  const resolvedTabId = normalizeRoutePath(tabId ?? normalizedPathname);
  const routeMatch = React.useMemo(
    () =>
      findDeepestRouteMatch(
        resolvedTabId,
        router.routesByPath as unknown as Record<string, unknown>
      ),
    [resolvedTabId, router.routesByPath]
  );
  const staticData = routeMatch?.staticData;
  const routeWorkspaceConfig = React.useMemo(
    () => resolveRouteWorkspaceConfig(routeMatch?.pattern ?? resolvedTabId, staticData, treeLookup),
    [resolvedTabId, routeMatch?.pattern, staticData, treeLookup]
  );
  const resolvedInitialTitle = initialTitle ?? resolveRouteTagTitle(staticData, resolvedTabId, treeLookup);
  const resolvedKeepAlive =
    staticData?.workspace?.keepAlive ?? legacyKeepAlive ?? routeWorkspaceConfig.keepAlive;
  const resolvedClosable =
    staticData?.workspace?.closable ?? legacyClosable ?? routeWorkspaceConfig.closable;
  const isCurrentRouteInstance = normalizedPathname === resolvedTabId;

  if (!enabled) {
    return <>{(renderWhenDisabled ?? render)()}</>;
  }

  if (!isCurrentRouteInstance) {
    return null;
  }

  return (
    <WorkspacePageBoundaryRegistration
      key={resolvedTabId}
      tabId={resolvedTabId}
      initialTitle={resolvedInitialTitle}
      keepAlive={resolvedKeepAlive}
      closable={resolvedClosable}
      render={render}
      errorFallback={errorFallback}
    />
  );
}

function WorkspacePageBoundaryRegistration({
  tabId,
  initialTitle,
  keepAlive,
  closable,
  render,
  errorFallback
}: {
  tabId: string;
  initialTitle: string;
  keepAlive: boolean;
  closable: boolean;
  render: () => React.ReactNode;
  errorFallback?: React.ReactNode;
}) {
  const renderRef = React.useRef(render);
  renderRef.current = render;

  const stableRender = React.useCallback(() => renderRef.current(), []);
  const descriptor = React.useMemo<WorkspacePageDescriptor>(
    () => ({
      tabId,
      initialTitle,
      keepAlive,
      closable,
      render: stableRender,
      errorFallback
    }),
    [closable, errorFallback, initialTitle, keepAlive, stableRender, tabId]
  );

  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

  useIsomorphicLayoutEffect(() => {
    useWorkspaceTabStore.getState().registerPageDescriptor(tabId, descriptor);
  }, [descriptor, tabId]);

  return null;
}
