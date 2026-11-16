import * as React from 'react';
import type { WorkspacePageDescriptor, WorkspacePageLifecyclePatch } from '../types';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import {
  dismissWorkspacePageOverlays,
  registerWorkspacePageOverlayRoot
} from '../utils/page-overlays';
import { registerWorkspaceOverlay } from '../utils/workspace-overlay-registry';
import {
  WorkspacePageActiveContext,
  WorkspacePageLifecycleContext
} from '../hooks/use-workspace-page';
import { Activity } from './activity';
import { WorkspaceSlotErrorBoundary } from './workspace-slot-error-boundary';
import { Icons } from '@/components/icons';
import { RouterSuspenseProgressSignal } from '@/components/layout/router-progress';
import { DefaultErrorPage } from '@/components/layout/default-error-page';
import PageContainer from '@/components/layout/page-container';
import { OverlayLifecycleProvider } from '@/components/ui/overlay-lifecycle';

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
          key={`${tabs[tagId]?.instanceKey ?? tagId}:${tabs[tagId]?.renderVersion ?? 0}`}
          tagId={tagId}
          fallback={descriptor.errorFallback ?? renderDefaultWorkspaceFallback}
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
  const content = React.useMemo(() => render(), [render]);

  return (
    // Activity hidden 会清理子树 Effects；Overlay Root 必须位于其外层，确保切换期间
    // page-overlays 仍能找到上一页的 trigger 与 aria-controls / aria-describedby 关系。
    <WorkspacePageOverlayRoot tagId={tagId}>
      <Activity mode={hidden ? 'hidden' : 'visible'}>{content}</Activity>
    </WorkspacePageOverlayRoot>
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

  const lifecycleValue = React.useMemo(
    () => ({ tabId: tagId, updateLifecycle }),
    [tagId, updateLifecycle]
  );
  const registerOverlay = React.useCallback(
    (close: () => void) => registerWorkspaceOverlay(tagId, close),
    [tagId]
  );

  return (
    <WorkspacePageActiveContext.Provider value={active}>
      <WorkspacePageLifecycleContext.Provider value={lifecycleValue}>
        <OverlayLifecycleProvider registerOverlay={registerOverlay}>
          {children}
        </OverlayLifecycleProvider>
      </WorkspacePageLifecycleContext.Provider>
    </WorkspacePageActiveContext.Provider>
  );
}

function renderDefaultWorkspaceFallback(error: Error) {
  return (
    <PageContainer contentSizing='contained'>
      <DefaultErrorPage
        code='500'
        layout='contained'
        title='运行时错误'
        description='加载失败，请刷新页面重试。若仍无法恢复，请联系技术人员。'
        alertTitle='页面加载失败'
        alertDescription={
          import.meta.env.DEV ? error.message : '当前页面发生异常，暂时无法继续操作。'
        }
        action={{
          label: '刷新页面',
          icon: Icons.rotateClockwise,
          onClick: () => window.location.reload()
        }}
      />
    </PageContainer>
  );
}
