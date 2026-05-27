import { create } from 'zustand'
import type {
  WorkspaceTab,
  WorkspaceTagId,
  WorkspaceTagSnapshot,
  WorkspacePageDescriptor,
  WorkspacePageLifecycle,
  WorkspacePageLifecyclePatch,
} from '../types'
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home'
import { MAX_KEEPALIVE_TABS } from '@/config/workspace-tabs'

interface WorkspaceTagState {
  tabs: Record<WorkspaceTagId, WorkspaceTab>
  activeId: WorkspaceTagId | null
  openedOrder: WorkspaceTagId[]
  disabledKeepAliveIds: Set<WorkspaceTagId>
  pageDescriptors: Record<WorkspaceTagId, WorkspacePageDescriptor>
  lifecycleSnapshots: Record<WorkspaceTagId, WorkspacePageLifecycle>

  openOrActivate: (tab: WorkspaceTab) => void
  close: (id: WorkspaceTagId) => void
  closeOther: (id: WorkspaceTagId) => void
  closeAll: () => void
  touch: (id: WorkspaceTagId) => void
  evictInactive: (keepAliveIds: Set<WorkspaceTagId>) => void
  disableKeepAlive: (id: WorkspaceTagId) => void
  enableKeepAlive: (id: WorkspaceTagId) => void
  getSnapshot: () => WorkspaceTagSnapshot

  registerPageDescriptor: (tabId: WorkspaceTagId, descriptor: WorkspacePageDescriptor) => void
  unregisterPageDescriptor: (tabId: WorkspaceTagId) => void
  updateLifecycle: (tabId: WorkspaceTagId, patch: WorkspacePageLifecyclePatch) => void
  resetAll: () => void
}

function makeDefaultLifecycle(title: string): WorkspacePageLifecycle {
  return { title, dirty: false }
}

export const useWorkspaceTagStore = create<WorkspaceTagState>()((set, get) => ({
  tabs: {},
  activeId: null,
  openedOrder: [],
  disabledKeepAliveIds: new Set(),
  pageDescriptors: {},
  lifecycleSnapshots: {},

  openOrActivate: (tab) => {
    const result = set((state) => {
      const existing = state.tabs[tab.id]
      if (existing) {
        return {
          activeId: tab.id,
          tabs: {
            ...state.tabs,
            [tab.id]: { ...existing, href: tab.href, title: tab.title, lastVisitedAt: Date.now() },
          },
        }
      }
      return {
        activeId: tab.id,
        tabs: { ...state.tabs, [tab.id]: { ...tab, lastVisitedAt: Date.now() } },
        openedOrder: state.openedOrder.includes(tab.id)
          ? state.openedOrder
          : [...state.openedOrder, tab.id],
      }
    })
    _enforceLruAfterOpen()
    return result
  },

  close: (id) =>
    set((state) => {
      const { [id]: _removed, ...restTabs } = state.tabs
      const { [id]: _removedDesc, ...restDesc } = state.pageDescriptors
      const { [id]: _removedLife, ...restLife } = state.lifecycleSnapshots
      const order = state.openedOrder.filter((oid) => oid !== id)
      const nextDisabled = new Set(state.disabledKeepAliveIds)
      nextDisabled.delete(id)

      let nextActive = state.activeId
      if (state.activeId === id) {
        nextActive = findFallback(state.tabs, id)
      }
      return {
        tabs: restTabs,
        activeId: nextActive,
        openedOrder: order,
        pageDescriptors: restDesc,
        lifecycleSnapshots: restLife,
        disabledKeepAliveIds: nextDisabled,
      }
    }),

  closeOther: (id) =>
    set((state) => {
      const keptTab = state.tabs[id]
      if (!keptTab) return state

      const keptDescriptors: Record<string, WorkspacePageDescriptor> = {}
      const keptLifecycles: Record<string, WorkspacePageLifecycle> = {}
      if (state.pageDescriptors[id]) keptDescriptors[id] = state.pageDescriptors[id]
      if (state.lifecycleSnapshots[id]) keptLifecycles[id] = state.lifecycleSnapshots[id]

      const nextDisabled = new Set(state.disabledKeepAliveIds)
      for (const oid of state.openedOrder) {
        if (oid !== id) nextDisabled.delete(oid)
      }

      const activeId = id
      return {
        tabs: { [id]: keptTab },
        activeId,
        openedOrder: [id],
        pageDescriptors: keptDescriptors,
        lifecycleSnapshots: keptLifecycles,
        disabledKeepAliveIds: nextDisabled,
      }
    }),

  closeAll: () =>
    set((state) => {
      const homeId = resolveDashboardHomeHref()
      const homeTab = state.tabs[homeId]
      if (homeTab) {
        const keptDescriptors: Record<string, WorkspacePageDescriptor> = {}
        const keptLifecycles: Record<string, WorkspacePageLifecycle> = {}
        if (state.pageDescriptors[homeId]) keptDescriptors[homeId] = state.pageDescriptors[homeId]
        if (state.lifecycleSnapshots[homeId]) keptLifecycles[homeId] = state.lifecycleSnapshots[homeId]

        return {
          tabs: { [homeId]: homeTab },
          activeId: homeId,
          openedOrder: [homeId],
          pageDescriptors: keptDescriptors,
          lifecycleSnapshots: keptLifecycles,
          disabledKeepAliveIds: new Set(),
        }
      }
      return {
        tabs: {},
        activeId: null,
        openedOrder: [],
        pageDescriptors: {},
        lifecycleSnapshots: {},
        disabledKeepAliveIds: new Set(),
      }
    }),

  touch: (id) =>
    set((state) => {
      const tab = state.tabs[id]
      if (!tab) return state
      return { tabs: { ...state.tabs, [id]: { ...tab, lastVisitedAt: Date.now() } } }
    }),

  evictInactive: (keepAliveIds) =>
    set((state) => {
      const kept: Record<string, WorkspaceTab> = {}
      for (const id of Object.keys(state.tabs)) {
        if (keepAliveIds.has(id)) kept[id] = state.tabs[id]
      }
      return { tabs: kept, openedOrder: state.openedOrder.filter((id) => keepAliveIds.has(id)) }
    }),

  disableKeepAlive: (id) =>
    set((state) => {
      const next = new Set(state.disabledKeepAliveIds)
      next.add(id)
      return { disabledKeepAliveIds: next }
    }),

  enableKeepAlive: (id) =>
    set((state) => {
      const next = new Set(state.disabledKeepAliveIds)
      next.delete(id)
      return { disabledKeepAliveIds: next }
    }),

  getSnapshot: () => {
    const { tabs, activeId, openedOrder } = get()
    return { tabs: Object.values(tabs), activeId, openedOrder }
  },

  // ─── V2 page descriptor lifecycle ───

  registerPageDescriptor: (tabId, descriptor) =>
    set((state) => {
      const existing = state.tabs[tabId]
      const tab: WorkspaceTab = {
        id: tabId,
        href: tabId,
        title: descriptor.initialTitle,
        closable: descriptor.closable,
        keepAlive: descriptor.keepAlive,
        lastVisitedAt: Date.now(),
      }

      const nextLifecycle: WorkspacePageLifecycle = {
        ...makeDefaultLifecycle(descriptor.initialTitle),
        ...(state.lifecycleSnapshots[tabId]
          ? { title: state.lifecycleSnapshots[tabId].title }
          : {}),
      }

      return {
        pageDescriptors: { ...state.pageDescriptors, [tabId]: descriptor },
        lifecycleSnapshots: { ...state.lifecycleSnapshots, [tabId]: nextLifecycle },
        tabs: existing
          ? { ...state.tabs, [tabId]: { ...existing, title: nextLifecycle.title, href: tabId } }
          : { ...state.tabs, [tabId]: tab },
        activeId: tabId,
        openedOrder: state.openedOrder.includes(tabId)
          ? state.openedOrder
          : [...state.openedOrder, tabId],
      }
    }),

  unregisterPageDescriptor: (tabId) =>
    set((state) => {
      const { [tabId]: _desc, ...restDesc } = state.pageDescriptors
      const { [tabId]: _life, ...restLife } = state.lifecycleSnapshots
      return { pageDescriptors: restDesc, lifecycleSnapshots: restLife }
    }),

  updateLifecycle: (tabId, patch) =>
    set((state) => {
      const existing = state.lifecycleSnapshots[tabId]
      const nextLife: WorkspacePageLifecycle = {
        title: patch.title ?? existing?.title ?? '',
        dirty: patch.dirty ?? existing?.dirty ?? false,
        closeGuard: patch.closeGuard !== undefined ? patch.closeGuard : existing?.closeGuard,
      }

      const tab = state.tabs[tabId]
      const nextTabs = tab
        ? { ...state.tabs, [tabId]: { ...tab, title: nextLife.title } }
        : state.tabs

      return {
        lifecycleSnapshots: { ...state.lifecycleSnapshots, [tabId]: nextLife },
        tabs: nextTabs,
      }
    }),

  resetAll: () =>
    set({
      tabs: {},
      activeId: null,
      openedOrder: [],
      disabledKeepAliveIds: new Set(),
      pageDescriptors: {},
      lifecycleSnapshots: {},
    }),
}))

function _enforceLruAfterOpen() {
  const state = useWorkspaceTagStore.getState()
  const keepAliveTabs = Object.values(state.tabs).filter((t) => t.keepAlive)
  if (keepAliveTabs.length <= MAX_KEEPALIVE_TABS) return

  const sorted = [...keepAliveTabs].sort((a, b) => a.lastVisitedAt - b.lastVisitedAt)
  const toEvict = new Set<WorkspaceTagId>()

  for (const tab of sorted) {
    if (keepAliveTabs.length - toEvict.size <= MAX_KEEPALIVE_TABS) break
    if (state.lifecycleSnapshots[tab.id]?.dirty) continue
    toEvict.add(tab.id)
  }

  if (toEvict.size === 0) return

  const keepIds = new Set(Object.keys(state.tabs).filter((id) => !toEvict.has(id)))
  useWorkspaceTagStore.getState().evictInactive(keepIds)
}

function findFallback(
  tabs: Record<WorkspaceTagId, WorkspaceTab>,
  closedId: WorkspaceTagId,
): WorkspaceTagId | null {
  const sorted = Object.values(tabs)
    .filter((t) => t.id !== closedId)
    .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt)
  return sorted[0]?.id ?? null
}
