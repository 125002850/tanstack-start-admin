import * as React from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { findDeepestRouteMatch, normalizeRoutePath } from '../hooks/use-dashboard-route-tag-sync';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
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
  const location = useRouterState({ select: (s) => s.location });
  const normalizedPathname = normalizeRoutePath(location.pathname);
  const renderKey = `${normalizedPathname}${location.searchStr || ''}`;
  const initialPathnameRef = React.useRef(normalizedPathname);
  const resolvedTabId = normalizeRoutePath(tabId ?? initialPathnameRef.current);
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
  const resolvedInitialTitle =
    initialTitle ?? resolveRouteTagTitle(staticData, resolvedTabId, treeLookup);
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
      renderKey={renderKey}
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
  renderKey,
  render,
  errorFallback
}: {
  tabId: string;
  initialTitle: string;
  keepAlive: boolean;
  closable: boolean;
  renderKey: string;
  render: () => React.ReactNode;
  errorFallback?: React.ReactNode;
}) {
  const hasCommittedRef = React.useRef(false);
  const descriptor = React.useMemo<WorkspacePageDescriptor>(
    () => ({
      tabId,
      initialTitle,
      keepAlive,
      closable,
      renderKey,
      render,
      errorFallback
    }),
    [closable, errorFallback, initialTitle, keepAlive, render, renderKey, tabId]
  );

  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

  useIsomorphicLayoutEffect(() => {
    const existingDescriptor = useWorkspacePageRegistryStore.getState().descriptors[tabId];
    const shouldRefresh =
      !existingDescriptor ||
      existingDescriptor.renderKey !== descriptor.renderKey ||
      hasCommittedRef.current;

    if (shouldRefresh) {
      useWorkspaceTabStore.getState().registerPageDescriptor(tabId, descriptor);
    }
    hasCommittedRef.current = true;
  }, [descriptor, tabId]);

  return null;
}
