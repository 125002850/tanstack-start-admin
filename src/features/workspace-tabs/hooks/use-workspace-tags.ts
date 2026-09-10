import { useRouter } from '@tanstack/react-router';
import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { isDashboardHomeHref, resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import type { WorkspaceTab, WorkspaceTabId } from '../types';
import {
  captureWorkspacePageOverlays,
  dismissWorkspacePageOverlays,
  type WorkspacePageOverlaySnapshot
} from '../utils/page-overlays';
import { useWorkspaceTabStore } from '../utils/store';

const CLOSE_GUARD_TIMEOUT_MS = 1500;

async function dismissWorkspaceTabOverlays(tabIds: WorkspaceTabId[]) {
  for (const tabId of tabIds) {
    const dismissResult = dismissWorkspacePageOverlays(tabId);
    if (dismissResult.hasPendingExit) {
      await dismissResult.waitForSettled();
    }
  }
}

async function checkCloseGuard(
  tabId: WorkspaceTabId,
  reason: 'close-current' | 'close-other' | 'close-all'
): Promise<boolean> {
  const lifecycle = useWorkspaceTabStore.getState().lifecycleSnapshots[tabId];
  if (!lifecycle?.closeGuard) return true;
  try {
    const result = await Promise.race([
      lifecycle.closeGuard({ tabId, reason }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('closeGuard timeout')), CLOSE_GUARD_TIMEOUT_MS)
      )
    ]);
    return result !== false;
  } catch {
    return false;
  }
}

export function useWorkspaceTags() {
  const router = useRouter();
  const activationSequenceRef = useRef(0);
  const tabs = useWorkspaceTabStore((state) => state.tabs);
  const activeId = useWorkspaceTabStore((state) => state.activeId);
  const openedOrder = useWorkspaceTabStore((state) => state.openedOrder);
  const lifecycleSnapshots = useWorkspaceTabStore((state) => state.lifecycleSnapshots);

  const navigate = useCallback(
    (href: string) => {
      router.navigate({ to: href });
    },
    [router]
  );

  const captureActivePageOverlays = useCallback((nextTabId: WorkspaceTabId) => {
    const currentActiveId = useWorkspaceTabStore.getState().activeId;
    if (!currentActiveId || currentActiveId === nextTabId) return null;
    return captureWorkspacePageOverlays(currentActiveId);
  }, []);

  const openOrActivate = useCallback(
    (tab: WorkspaceTab, overlaySnapshot?: WorkspacePageOverlaySnapshot | null) => {
      const sequence = activationSequenceRef.current + 1;
      activationSequenceRef.current = sequence;
      const currentActiveId = useWorkspaceTabStore.getState().activeId;
      let navigateAfterDismiss = () => navigate(tab.href);

      if (currentActiveId && currentActiveId !== tab.id) {
        const dismissResult = dismissWorkspacePageOverlays(currentActiveId, overlaySnapshot);
        if (dismissResult.hasPendingExit) {
          navigateAfterDismiss = () => {
            void dismissResult.waitForSettled().then(() => {
              if (activationSequenceRef.current === sequence) {
                navigate(tab.href);
              }
            });
          };
        }
      }

      navigateAfterDismiss();
    },
    [navigate]
  );

  const close = useCallback(
    async (id: WorkspaceTabId) => {
      const requestedTab = useWorkspaceTabStore.getState().tabs[id];
      if (!requestedTab || isDashboardHomeHref(requestedTab.href)) return;

      const ok = await checkCloseGuard(id, 'close-current');
      if (!ok) {
        toast.warning('当前页面有未保存的更改，无法关闭标签');
        return;
      }
      await dismissWorkspaceTabOverlays([id]);

      const currentState = useWorkspaceTabStore.getState();
      if (currentState.tabs[id] !== requestedTab) return;
      currentState.close(id);
      const nextActive = useWorkspaceTabStore.getState().activeId;
      if (nextActive) {
        const nextTab = useWorkspaceTabStore.getState().tabs[nextActive];
        if (nextTab) navigate(nextTab.href);
      }
    },
    [navigate]
  );

  const closeOther = useCallback(
    async (id: WorkspaceTabId) => {
      const state = useWorkspaceTabStore.getState();
      const homeId = resolveDashboardHomeHref();
      const tabIdsToClose = state.openedOrder.filter((oid) => oid !== id && oid !== homeId);

      for (const tid of tabIdsToClose) {
        const ok = await checkCloseGuard(tid, 'close-other');
        if (!ok) {
          const state = useWorkspaceTabStore.getState();
          const title = state.lifecycleSnapshots[tid]?.title ?? state.tabs[tid]?.title ?? '';
          toast.warning(`「${title}」有未保存的更改，已切换至该页面`);
          const rejectingTab = state.tabs[tid];
          if (rejectingTab) navigate(rejectingTab.href);
          return;
        }
      }

      await dismissWorkspaceTabOverlays(tabIdsToClose);
      useWorkspaceTabStore.getState().closeOther(id);
      const tab = useWorkspaceTabStore.getState().tabs[id];
      if (tab) navigate(tab.href);
    },
    [navigate]
  );

  const closeAll = useCallback(async () => {
    const state = useWorkspaceTabStore.getState();
    const homeId = resolveDashboardHomeHref();
    const tabIdsToClose = state.openedOrder.filter((oid) => oid !== homeId);

    for (const tid of tabIdsToClose) {
      const ok = await checkCloseGuard(tid, 'close-all');
      if (!ok) {
        const title = state.lifecycleSnapshots[tid]?.title ?? state.tabs[tid]?.title ?? '';
        toast.warning(`「${title}」有未保存的更改，已切换至该页面`);
        const rejectingTab = state.tabs[tid];
        if (rejectingTab) navigate(rejectingTab.href);
        return;
      }
    }

    await dismissWorkspaceTabOverlays(tabIdsToClose);
    useWorkspaceTabStore.getState().closeAll();
    navigate(resolveDashboardHomeHref());
  }, [navigate]);

  const refresh = useCallback(
    async (id: WorkspaceTabId) => {
      const state = useWorkspaceTabStore.getState();
      const tab = state.tabs[id];
      if (!tab) return;

      try {
        if (state.activeId !== id) {
          await router.navigate({ to: tab.href });
          // Router 加载完成不代表 workspace 的 layout effect 已提交激活状态。
          if (useWorkspaceTabStore.getState().activeId !== id) {
            if (router.latestLocation.href !== router.buildLocation({ to: tab.href }).href) return;
            await new Promise<void>((resolve) => {
              let stopNavigation = () => {};
              const finish = () => {
                stopStore();
                stopNavigation();
                resolve();
              };
              const stopStore = useWorkspaceTabStore.subscribe((next) => {
                if (next.activeId !== state.activeId || !next.tabs[id]) finish();
              });
              // 用户发起其他导航时取消等待，避免刷新错误页面。
              stopNavigation = router.subscribe('onBeforeNavigate', finish);
            });
          }
        }
        if (useWorkspaceTabStore.getState().activeId !== id) return;
        // 重建会丢弃局部状态，沿用页面的未保存更改确认；等待用户决策，不设关闭超时。
        const guard = useWorkspaceTabStore.getState().lifecycleSnapshots[id]?.closeGuard;
        if (guard && (await guard({ tabId: id, reason: 'refresh' })) === false) return;
        if (useWorkspaceTabStore.getState().activeId !== id) return;
        await dismissWorkspaceTabOverlays([id]);
        await router.invalidate({ sync: true });
        if (useWorkspaceTabStore.getState().activeId !== id) return;
        // 先提交新页面树，再刷新其活跃查询，避免刷新被卸载页面的旧筛选请求。
        flushSync(() => useWorkspaceTabStore.getState().remountPage(id));
        await router.options.context.queryClient.invalidateQueries({ type: 'active' });
      } catch {
        toast.error('刷新页面失败，请重试');
      }
    },
    [router]
  );

  const touch = useCallback((id: WorkspaceTabId) => {
    useWorkspaceTabStore.getState().touch(id);
  }, []);

  const evictInactive = useCallback((keepAliveIds: Set<WorkspaceTabId>) => {
    useWorkspaceTabStore.getState().evictInactive(keepAliveIds);
  }, []);

  return {
    tabs,
    activeId,
    openedOrder,
    lifecycleSnapshots,
    captureActivePageOverlays,
    openOrActivate,
    close,
    closeOther,
    closeAll,
    refresh,
    touch,
    evictInactive
  };
}
