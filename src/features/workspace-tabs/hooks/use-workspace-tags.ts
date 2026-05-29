import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { isDashboardHomeHref, resolveDashboardHomeHref } from '@/lib/router/dashboard-home'
import type { WorkspaceTab, WorkspaceTagId } from '../types'
import { useWorkspaceTagStore } from '../utils/store'

const CLOSE_GUARD_TIMEOUT_MS = 1500

async function checkCloseGuard(
  tabId: WorkspaceTagId,
  reason: 'close-current' | 'close-other' | 'close-all',
): Promise<boolean> {
  const lifecycle = useWorkspaceTagStore.getState().lifecycleSnapshots[tabId]
  if (!lifecycle?.closeGuard) return true
  try {
    const result = await Promise.race([
      lifecycle.closeGuard({ tabId, reason }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('closeGuard timeout')), CLOSE_GUARD_TIMEOUT_MS),
      ),
    ])
    return result !== false
  } catch {
    return false
  }
}

export function useWorkspaceTags() {
  const router = useRouter()
  const tabs = useWorkspaceTagStore((state) => state.tabs)
  const activeId = useWorkspaceTagStore((state) => state.activeId)
  const openedOrder = useWorkspaceTagStore((state) => state.openedOrder)
  const lifecycleSnapshots = useWorkspaceTagStore((state) => state.lifecycleSnapshots)

  const navigate = useCallback(
    (href: string) => {
      router.navigate({ to: href })
    },
    [router],
  )

  const openOrActivate = useCallback(
    (tab: WorkspaceTab) => {
      useWorkspaceTagStore.getState().openOrActivate(tab)
      navigate(tab.href)
    },
    [navigate],
  )

  const close = useCallback(
    async (id: WorkspaceTagId) => {
      const tab = useWorkspaceTagStore.getState().tabs[id]
      if (!tab || isDashboardHomeHref(tab.href)) return

      const ok = await checkCloseGuard(id, 'close-current')
      if (!ok) {
        toast.warning('当前页面有未保存的更改，无法关闭标签')
        return
      }

      useWorkspaceTagStore.getState().close(id)
      const nextActive = useWorkspaceTagStore.getState().activeId
      if (nextActive) {
        const nextTab = useWorkspaceTagStore.getState().tabs[nextActive]
        if (nextTab) navigate(nextTab.href)
      }
    },
    [navigate],
  )

  const closeOther = useCallback(
    async (id: WorkspaceTagId) => {
      const state = useWorkspaceTagStore.getState()
      const homeId = resolveDashboardHomeHref()
      const tabIdsToClose = state.openedOrder.filter((oid) => oid !== id && oid !== homeId)

      for (const tid of tabIdsToClose) {
        const ok = await checkCloseGuard(tid, 'close-other')
        if (!ok) {
          const state = useWorkspaceTagStore.getState()
          const title = state.lifecycleSnapshots[tid]?.title ?? state.tabs[tid]?.title ?? ''
          toast.warning(`「${title}」有未保存的更改，已切换至该页面`)
          const rejectingTab = state.tabs[tid]
          if (rejectingTab) navigate(rejectingTab.href)
          return
        }
      }

      useWorkspaceTagStore.getState().closeOther(id)
      const tab = useWorkspaceTagStore.getState().tabs[id]
      if (tab) navigate(tab.href)
    },
    [navigate],
  )

  const closeAll = useCallback(async () => {
    const state = useWorkspaceTagStore.getState()
    const homeId = resolveDashboardHomeHref()
    const tabIdsToClose = state.openedOrder.filter((oid) => oid !== homeId)

    for (const tid of tabIdsToClose) {
      const ok = await checkCloseGuard(tid, 'close-all')
      if (!ok) {
        const title = state.lifecycleSnapshots[tid]?.title ?? state.tabs[tid]?.title ?? ''
        toast.warning(`「${title}」有未保存的更改，已切换至该页面`)
        const rejectingTab = state.tabs[tid]
        if (rejectingTab) navigate(rejectingTab.href)
        return
      }
    }

    useWorkspaceTagStore.getState().closeAll()
    navigate(resolveDashboardHomeHref())
  }, [navigate])

  const refresh = useCallback(
    (id: WorkspaceTagId) => {
      const tab = useWorkspaceTagStore.getState().tabs[id]
      if (tab) navigate(tab.href)
    },
    [navigate],
  )

  const touch = useCallback(
    (id: WorkspaceTagId) => {
      useWorkspaceTagStore.getState().touch(id)
    },
    [],
  )

  const evictInactive = useCallback(
    (keepAliveIds: Set<WorkspaceTagId>) => {
      useWorkspaceTagStore.getState().evictInactive(keepAliveIds)
    },
    [],
  )

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
    evictInactive,
  }
}
