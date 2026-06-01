import { create } from 'zustand'
import type {
  WorkspaceTab,
  WorkspaceTabId,
  WorkspaceTabOpenInput,
  WorkspaceTabSnapshot,
  WorkspacePageDescriptor,
  WorkspacePageLifecycle,
  WorkspacePageLifecyclePatch,
} from '../types'
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home'
import { MAX_KEEPALIVE_TABS } from '@/config/workspace-tabs'

const HOME_ID = resolveDashboardHomeHref()
const HOME_TITLE = '仪表盘'

interface WorkspaceTabState {
  tabs: Record<WorkspaceTabId, WorkspaceTab>
  activeId: WorkspaceTabId | null
  openedOrder: WorkspaceTabId[]
  disabledKeepAliveIds: Set<WorkspaceTabId>
  pageDescriptors: Record<WorkspaceTabId, WorkspacePageDescriptor>
  lifecycleSnapshots: Record<WorkspaceTabId, WorkspacePageLifecycle>

  openOrActivate: (tab: WorkspaceTabOpenInput) => void
  close: (id: WorkspaceTabId) => void
  closeOther: (id: WorkspaceTabId) => void
  closeAll: () => void
  touch: (id: WorkspaceTabId) => void
  evictInactive: (keepAliveIds: Set<WorkspaceTabId>) => void
  disableKeepAlive: (id: WorkspaceTabId) => void
  enableKeepAlive: (id: WorkspaceTabId) => void
  getSnapshot: () => WorkspaceTabSnapshot

  registerPageDescriptor: (tabId: WorkspaceTabId, descriptor: WorkspacePageDescriptor) => void
  unregisterPageDescriptor: (tabId: WorkspaceTabId) => void
  updateLifecycle: (tabId: WorkspaceTabId, patch: WorkspacePageLifecyclePatch) => void
  resetAll: () => void
}

function makeDefaultLifecycle(title: string): WorkspacePageLifecycle {
  return { title, dirty: false }
}

function createBaseState(): Pick<
  WorkspaceTabState,
  'tabs' | 'activeId' | 'openedOrder' | 'disabledKeepAliveIds' | 'pageDescriptors' | 'lifecycleSnapshots'
> {
  const homeTab = createHomeTab()
  return {
    tabs: { [HOME_ID]: homeTab },
    activeId: HOME_ID,
    openedOrder: [HOME_ID],
    disabledKeepAliveIds: new Set(),
    pageDescriptors: {},
    lifecycleSnapshots: {},
  }
}

export const useWorkspaceTabStore = create<WorkspaceTabState>()((set, get) => ({
  ...createBaseState(),

  openOrActivate: (tab) =>
    set((state) => {
      const existing = state.tabs[tab.id]

      // Step 1: Build the base next state (open or activate the tab)
      let nextTabs: Record<WorkspaceTabId, WorkspaceTab>
      let nextPageDescriptors: Record<WorkspaceTabId, WorkspacePageDescriptor>
      let nextLifecycleSnapshots: Record<WorkspaceTabId, WorkspacePageLifecycle>
      let nextActiveId: WorkspaceTabId
      let nextOpenedOrder: WorkspaceTabId[]

      if (existing) {
        nextTabs = {
          ...state.tabs,
          [tab.id]: { ...existing, href: tab.href, title: tab.title, lastVisitedAt: Date.now() },
        }
        nextActiveId = tab.id
        nextPageDescriptors = state.pageDescriptors
        nextLifecycleSnapshots = state.lifecycleSnapshots
        nextOpenedOrder = state.openedOrder
      } else {
        const nextTab: WorkspaceTab = {
          id: tab.id,
          href: tab.href,
          title: tab.title,
          closable: tab.closable ?? true,
          keepAlive: tab.keepAlive ?? false,
          lastVisitedAt: Date.now(),
        }
        nextTabs = { ...state.tabs, [tab.id]: nextTab }
        nextActiveId = tab.id
        nextPageDescriptors = state.pageDescriptors
        nextLifecycleSnapshots = state.lifecycleSnapshots
        nextOpenedOrder = normalizeOpenedOrder(
          state.openedOrder.includes(tab.id)
            ? state.openedOrder
            : [...state.openedOrder, tab.id],
        )
      }

      // Step 2: Enforce LRU eviction within the same atomic update.
      // Previously this was an off-cycle mutation (enforceLruAfterOpen) that
      // called evictInactive via a separate set() after openOrActivate returned,
      // which could cause subscriber ordering bugs.
      const keepAliveTabs = Object.values(nextTabs).filter((t) => t.keepAlive)
      if (keepAliveTabs.length > MAX_KEEPALIVE_TABS) {
        const sorted = keepAliveTabs.toSorted((a, b) => a.lastVisitedAt - b.lastVisitedAt)
        const toEvict = new Set<WorkspaceTabId>()

        for (const t of sorted) {
          if (keepAliveTabs.length - toEvict.size <= MAX_KEEPALIVE_TABS) break
          // Never evict the tab we just opened — its lifecycle snapshot may not
          // be registered yet (registerPageDescriptor runs in a LayoutEffect),
          // so the dirty guard above would treat it as evictable.
          if (t.id === tab.id) continue
          if (state.lifecycleSnapshots[t.id]?.dirty) continue
          toEvict.add(t.id)
        }

        if (toEvict.size > 0) {
          // Prune evicted tabs from all state slices to prevent unbounded growth
          const kept: Record<string, WorkspaceTab> = {}
          const keptDescriptors: Record<string, WorkspacePageDescriptor> = {}
          const keptLifecycles: Record<string, WorkspacePageLifecycle> = {}
          for (const id of Object.keys(nextTabs)) {
            if (!toEvict.has(id) || isHomeId(id)) {
              kept[id] = nextTabs[id]
              if (nextPageDescriptors[id]) keptDescriptors[id] = nextPageDescriptors[id]
              if (nextLifecycleSnapshots[id]) keptLifecycles[id] = nextLifecycleSnapshots[id]
            }
          }
          nextTabs = ensureHomeTab(kept)
          nextPageDescriptors = keptDescriptors
          nextLifecycleSnapshots = keptLifecycles
          nextOpenedOrder = normalizeOpenedOrder(
            nextOpenedOrder.filter((id) => !toEvict.has(id) || isHomeId(id)),
          )
        }
      }

      return { tabs: nextTabs, activeId: nextActiveId, openedOrder: nextOpenedOrder, pageDescriptors: nextPageDescriptors, lifecycleSnapshots: nextLifecycleSnapshots }
    }),

  close: (id) =>
    set((state) => {
      if (isHomeId(id)) return state
      const existingTab = state.tabs[id]
      if (!existingTab) return state

      const { [id]: _removed, ...restTabs } = state.tabs
      const { [id]: _removedDesc, ...restDesc } = state.pageDescriptors
      const { [id]: _removedLife, ...restLife } = state.lifecycleSnapshots
      const nextTabs = ensureHomeTab(restTabs)
      const order = normalizeOpenedOrder(state.openedOrder.filter((oid) => oid !== id))
      const nextDisabled = new Set(state.disabledKeepAliveIds)
      nextDisabled.delete(id)

      let nextActive = state.activeId
      if (state.activeId === id) {
        nextActive = findFallback(nextTabs, id)
      }
      return {
        tabs: nextTabs,
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

      const homeTab = state.tabs[HOME_ID]
      const keepHome = id !== HOME_ID
      const keptTabs: Record<string, WorkspaceTab> = keepHome
        ? {
            [HOME_ID]: homeTab ?? createHomeTab(),
            [id]: keptTab,
          }
        : { [HOME_ID]: homeTab ?? createHomeTab() }

      const keptDescriptors: Record<string, WorkspacePageDescriptor> = {}
      const keptLifecycles: Record<string, WorkspacePageLifecycle> = {}
      if (keepHome && state.pageDescriptors[HOME_ID]) keptDescriptors[HOME_ID] = state.pageDescriptors[HOME_ID]
      if (keepHome && state.lifecycleSnapshots[HOME_ID]) keptLifecycles[HOME_ID] = state.lifecycleSnapshots[HOME_ID]
      if (state.pageDescriptors[id]) keptDescriptors[id] = state.pageDescriptors[id]
      if (state.lifecycleSnapshots[id]) keptLifecycles[id] = state.lifecycleSnapshots[id]

      const nextDisabled = new Set(state.disabledKeepAliveIds)
      for (const oid of state.openedOrder) {
        if (oid !== id && oid !== HOME_ID) nextDisabled.delete(oid)
      }

      const activeId = id
      return {
        tabs: keptTabs,
        activeId,
        openedOrder: normalizeOpenedOrder(keepHome ? [HOME_ID, id] : [HOME_ID]),
        pageDescriptors: keptDescriptors,
        lifecycleSnapshots: keptLifecycles,
        disabledKeepAliveIds: nextDisabled,
      }
    }),

  closeAll: () =>
    set((state) => {
      const homeTab = state.tabs[HOME_ID]
      if (homeTab) {
        const keptDescriptors: Record<string, WorkspacePageDescriptor> = {}
        const keptLifecycles: Record<string, WorkspacePageLifecycle> = {}
        if (state.pageDescriptors[HOME_ID]) keptDescriptors[HOME_ID] = state.pageDescriptors[HOME_ID]
        if (state.lifecycleSnapshots[HOME_ID]) keptLifecycles[HOME_ID] = state.lifecycleSnapshots[HOME_ID]

        return {
          tabs: { [HOME_ID]: homeTab },
          activeId: HOME_ID,
          openedOrder: normalizeOpenedOrder([HOME_ID]),
          pageDescriptors: keptDescriptors,
          lifecycleSnapshots: keptLifecycles,
          disabledKeepAliveIds: new Set(),
        }
      }
      const nextHomeTab = createHomeTab()
      return {
        tabs: { [HOME_ID]: nextHomeTab },
        activeId: HOME_ID,
        openedOrder: normalizeOpenedOrder([HOME_ID]),
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
        if (keepAliveIds.has(id) || isHomeId(id)) kept[id] = state.tabs[id]
      }
      const tabs = ensureHomeTab(kept)
      return {
        tabs,
        openedOrder: normalizeOpenedOrder(
          state.openedOrder.filter((id) => keepAliveIds.has(id) || isHomeId(id)),
        ),
      }
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
      const existingDescriptor = state.pageDescriptors[tabId]
      const existingTab = state.tabs[tabId]
      const existingLifecycle = state.lifecycleSnapshots[tabId]

      const pageDescriptors = existingDescriptor
        ? state.pageDescriptors
        : { ...state.pageDescriptors, [tabId]: descriptor }

      const nextLifecycle = existingLifecycle ?? makeDefaultLifecycle(descriptor.initialTitle)
      const lifecycleSnapshots = existingLifecycle
        ? state.lifecycleSnapshots
        : { ...state.lifecycleSnapshots, [tabId]: nextLifecycle }

      const nextTab: WorkspaceTab = existingTab
        ? existingTab.title === nextLifecycle.title &&
          existingTab.closable === descriptor.closable &&
          existingTab.keepAlive === descriptor.keepAlive
          ? existingTab
          : {
              ...existingTab,
              title: nextLifecycle.title,
              closable: descriptor.closable,
              keepAlive: descriptor.keepAlive,
            }
        : {
            id: tabId,
            href: tabId,
            title: nextLifecycle.title,
            closable: descriptor.closable,
            keepAlive: descriptor.keepAlive,
            lastVisitedAt: Date.now(),
          }

      const tabs = existingTab
        ? nextTab === existingTab
          ? state.tabs
          : { ...state.tabs, [tabId]: nextTab }
        : { ...state.tabs, [tabId]: nextTab }

      const activeId = state.activeId === tabId ? state.activeId : tabId
      const openedOrder = normalizeOpenedOrder(
        state.openedOrder.includes(tabId)
          ? state.openedOrder
          : [...state.openedOrder, tabId],
      )

      if (
        pageDescriptors === state.pageDescriptors &&
        lifecycleSnapshots === state.lifecycleSnapshots &&
        tabs === state.tabs &&
        activeId === state.activeId &&
        openedOrder === state.openedOrder
      ) {
        return state
      }

      return {
        pageDescriptors,
        lifecycleSnapshots,
        tabs,
        activeId,
        openedOrder,
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
    set(createBaseState()),
}))

function findFallback(
  tabs: Record<WorkspaceTabId, WorkspaceTab>,
  closedId: WorkspaceTabId,
): WorkspaceTabId | null {
  const sorted = Object.values(tabs)
    .filter((t) => t.id !== closedId)
    .toSorted((a, b) => b.lastVisitedAt - a.lastVisitedAt)
  return sorted[0]?.id ?? null
}

function createHomeTab(lastVisitedAt = Date.now()): WorkspaceTab {
  return {
    id: HOME_ID,
    href: HOME_ID,
    title: HOME_TITLE,
    closable: false,
    keepAlive: false,
    lastVisitedAt,
  }
}

function ensureHomeTab(tabs: Record<WorkspaceTabId, WorkspaceTab>): Record<WorkspaceTabId, WorkspaceTab> {
  if (tabs[HOME_ID]) return tabs
  return { ...tabs, [HOME_ID]: createHomeTab() }
}

function isHomeId(id: WorkspaceTabId): boolean {
  return id === HOME_ID
}

function normalizeOpenedOrder(ids: WorkspaceTabId[]): WorkspaceTabId[] {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.includes(HOME_ID)) return uniqueIds
  return [HOME_ID, ...uniqueIds.filter((id) => id !== HOME_ID)]
}
