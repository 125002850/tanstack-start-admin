import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { isDashboardHomeHref, resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import type { WorkspaceTab, WorkspaceTabId } from '../types';
import { useWorkspaceTabStore } from '../utils/store';

const CLOSE_GUARD_TIMEOUT_MS = 1500;

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

  const openOrActivate = useCallback(
    (tab: WorkspaceTab) => {
      navigate(tab.href);
    },
    [navigate]
  );

  const close = useCallback(
    async (id: WorkspaceTabId) => {
      const tab = useWorkspaceTabStore.getState().tabs[id];
      if (!tab || isDashboardHomeHref(tab.href)) return;

      const ok = await checkCloseGuard(id, 'close-current');
      if (!ok) {
        toast.warning('当前页面有未保存的更改，无法关闭标签');
        return;
      }

      useWorkspaceTabStore.getState().close(id);
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

    useWorkspaceTabStore.getState().closeAll();
    navigate(resolveDashboardHomeHref());
  }, [navigate]);

  const refresh = useCallback(
    (id: WorkspaceTabId) => {
      const tab = useWorkspaceTabStore.getState().tabs[id];
      if (tab) navigate(tab.href);
    },
    [navigate]
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
    openOrActivate,
    close,
    closeOther,
    closeAll,
    refresh,
    touch,
    evictInactive
  };
}
