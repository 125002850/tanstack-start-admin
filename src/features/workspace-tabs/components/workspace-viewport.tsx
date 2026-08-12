import * as React from 'react';
import type { WorkspacePageDescriptor, WorkspacePageLifecyclePatch } from '../types';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import {
  dismissWorkspacePageOverlays,
  registerWorkspacePageOverlayRoot
} from '../utils/page-overlays';
import {
  WorkspacePageActiveContext,
  WorkspacePageLifecycleContext
} from '../hooks/use-workspace-page';
import { Activity } from './activity';
import { WorkspaceSlotErrorBoundary } from './workspace-slot-error-boundary';
import { Icons } from '@/components/icons';
import { RouterSuspenseProgressSignal } from '@/components/layout/router-progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  return (
    <WorkspacePageActiveContext.Provider value={active}>
      <WorkspacePageLifecycleContext.Provider value={lifecycleValue}>
        {children}
      </WorkspacePageLifecycleContext.Provider>
    </WorkspacePageActiveContext.Provider>
  );
}

function renderDefaultWorkspaceFallback(error: Error) {
  return (
    <div className='flex min-h-64 w-full items-center justify-center p-6'>
      <Alert variant='destructive' className='max-w-2xl shadow-sm'>
        <Icons.info className='size-4' aria-hidden='true' />
        <AlertTitle>页面模块加载失败</AlertTitle>
        <AlertDescription>
          <p>页面依赖或当前构建产物可能不一致。请先刷新页面；如果问题持续，请联系开发人员排查。</p>
          {import.meta.env.DEV ? (
            <>
              <p className='mt-2'>如果刚更新过接口契约，请依次运行：</p>
              <code className='bg-muted text-foreground rounded px-2 py-1 font-mono text-xs'>
                pnpm api &amp;&amp; pnpm typecheck
              </code>
              <details className='mt-2 w-full'>
                <summary className='cursor-pointer font-medium'>技术详情</summary>
                <code className='mt-1 block break-all font-mono text-xs'>{error.message}</code>
              </details>
            </>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}
