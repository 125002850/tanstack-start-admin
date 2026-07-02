import * as React from 'react';
import type { WorkspacePageDescriptor, WorkspacePageLifecyclePatch } from '../types';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import {
  dismissWorkspacePageOverlays,
  registerWorkspacePageOverlayRoot
} from '../utils/page-overlays';
import { WorkspacePageContext } from '../hooks/use-workspace-page';
import { Activity } from './activity';
import { WorkspaceSlotErrorBoundary } from './workspace-slot-error-boundary';
import { RouterSuspenseProgressSignal } from '@/lib/router/progress';

/**
 * WorkspaceViewport is the ActivityHost — the single owner of all page instances
 * when workspace tabs are enabled.
 *
 * V2 page descriptors (registered by WorkspacePageBoundary):
 *   - Active tab → rendered visibly
 *   - Inactive keep-alive tab → rendered via Activity hidden
 *   - Inactive non-keep-alive tab → not rendered (unmounted)
 */
export function WorkspaceViewport() {
  const tabs = useWorkspaceTabStore((s) => s.tabs);
  const activeId = useWorkspaceTabStore((s) => s.activeId);
  const pageDescriptors = useWorkspacePageRegistryStore((s) => s.descriptors);
  const disabledKeepAliveIds = useWorkspaceTabStore((s) => s.disabledKeepAliveIds);
  const previousActiveIdRef = React.useRef(activeId);

  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

  useIsomorphicLayoutEffect(() => {
    if (previousActiveIdRef.current && previousActiveIdRef.current !== activeId) {
      dismissWorkspacePageOverlays(previousActiveIdRef.current);
    }

    previousActiveIdRef.current = activeId;
  }, [activeId]);

  const entries = React.useMemo(() => {
    const result: Array<{
      tagId: string;
      descriptor: WorkspacePageDescriptor;
      active: boolean;
    }> = [];

    for (const [tagId, tab] of Object.entries(tabs)) {
      const desc = pageDescriptors[tagId];
      if (!desc) continue;

      const isActive = tagId === activeId;
      if (isActive) {
        result.push({ tagId, descriptor: desc, active: true });
      } else if (tab.keepAlive && !disabledKeepAliveIds.has(tagId)) {
        result.push({ tagId, descriptor: desc, active: false });
      }
    }

    return result;
  }, [tabs, activeId, pageDescriptors, disabledKeepAliveIds]);

  if (entries.length === 0) return null;

  return (
    <>
      {/* V2 page instances: active visible, inactive keep-alive hidden */}
      {entries.map(({ tagId, descriptor, active }) => (
        <WorkspaceSlotErrorBoundary
          key={tagId}
          tagId={tagId}
          fallback={descriptor.errorFallback ?? <DefaultWorkspaceFallback />}
        >
          <PageContextProvider active={active} tagId={tagId}>
            <React.Suspense fallback={active ? <RouterSuspenseProgressSignal /> : null}>
              <PageRenderer render={descriptor.render} hidden={!active} tagId={tagId} />
            </React.Suspense>
          </PageContextProvider>
        </WorkspaceSlotErrorBoundary>
      ))}
    </>
  );
}

function PageRenderer({
  render,
  hidden,
  tagId
}: {
  render: () => React.ReactNode;
  hidden: boolean;
  tagId: string;
}) {
  return (
    <Activity mode={hidden ? 'hidden' : 'visible'}>
      <WorkspacePageOverlayRoot tagId={tagId}>{render()}</WorkspacePageOverlayRoot>
    </Activity>
  );
}

function WorkspacePageOverlayRoot({
  children,
  tagId
}: {
  children: React.ReactNode;
  tagId: string;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    return registerWorkspacePageOverlayRoot(tagId, root);
  }, [tagId]);

  return (
    <div ref={rootRef} data-workspace-page-id={tagId} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

function PageContextProvider({
  active,
  children,
  tagId
}: {
  active: boolean;
  children: React.ReactNode;
  tagId: string;
}) {
  const updateLifecycle = React.useCallback(
    (patch: WorkspacePageLifecyclePatch) => {
      useWorkspaceTabStore.getState().updateLifecycle(tagId, patch);
    },
    [tagId]
  );

  const value = React.useMemo(
    () => ({ active, tabId: tagId, updateLifecycle }),
    [active, tagId, updateLifecycle]
  );

  return <WorkspacePageContext.Provider value={value}>{children}</WorkspacePageContext.Provider>;
}

function DefaultWorkspaceFallback() {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 200,
        color: 'var(--muted-foreground)',
        fontSize: 14
      }
    },
    '糟糕，页面找不到了'
  );
}
