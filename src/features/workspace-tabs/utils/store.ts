import { create } from 'zustand';
import type {
  WorkspaceTab,
  WorkspaceTabId,
  WorkspaceTabOpenInput,
  WorkspaceTabSnapshot,
  WorkspacePageDescriptor,
  WorkspacePageLifecycle,
  WorkspacePageLifecyclePatch
} from '../types';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { MAX_KEEPALIVE_TABS } from '@/config/workspace-tabs';
import { useWorkspacePageRegistryStore } from './page-registry';
import { dismissWorkspacePageOverlays, resetWorkspacePageOverlays } from './page-overlays';

const HOME_ID = resolveDashboardHomeHref();
const HOME_TITLE = '仪表盘';
let openOrActivateSequence = 0;

interface WorkspaceTabState {
  tabs: Record<WorkspaceTabId, WorkspaceTab>;
  activeId: WorkspaceTabId | null;
  openedOrder: WorkspaceTabId[];
  disabledKeepAliveIds: Set<WorkspaceTabId>;
  lifecycleSnapshots: Record<WorkspaceTabId, WorkspacePageLifecycle>;

  openOrActivate: (tab: WorkspaceTabOpenInput) => void;
  close: (id: WorkspaceTabId) => void;
  closeOther: (id: WorkspaceTabId) => void;
  closeAll: () => void;
  touch: (id: WorkspaceTabId) => void;
  evictInactive: (keepAliveIds: Set<WorkspaceTabId>) => void;
  disableKeepAlive: (id: WorkspaceTabId) => void;
  enableKeepAlive: (id: WorkspaceTabId) => void;
  getSnapshot: () => WorkspaceTabSnapshot;

  registerPageDescriptor: (tabId: WorkspaceTabId, descriptor: WorkspacePageDescriptor) => void;
  unregisterPageDescriptor: (tabId: WorkspaceTabId) => void;
  updateLifecycle: (tabId: WorkspaceTabId, patch: WorkspacePageLifecyclePatch) => void;
  resetAll: () => void;
}

function makeDefaultLifecycle(title: string): WorkspacePageLifecycle {
  return { title, dirty: false };
}

function createBaseState(): Pick<
  WorkspaceTabState,
  'tabs' | 'activeId' | 'openedOrder' | 'disabledKeepAliveIds' | 'lifecycleSnapshots'
> {
  const homeTab = createHomeTab();
  return {
    tabs: { [HOME_ID]: homeTab },
    activeId: HOME_ID,
    openedOrder: [HOME_ID],
    disabledKeepAliveIds: new Set(),
    lifecycleSnapshots: {}
  };
}

export const useWorkspaceTabStore = create<WorkspaceTabState>()((set, get) => ({
  ...createBaseState(),

  openOrActivate: (tab) => {
    const sequence = openOrActivateSequence + 1;
    openOrActivateSequence = sequence;

    const commit = () => {
      let evictedIds: WorkspaceTabId[] = [];

      set((state) => {
        const existing = state.tabs[tab.id];

        // Step 1: Build the base next state (open or activate the tab)
        let nextTabs: Record<WorkspaceTabId, WorkspaceTab>;
        let nextLifecycleSnapshots: Record<WorkspaceTabId, WorkspacePageLifecycle>;
        let nextActiveId: WorkspaceTabId;
        let nextOpenedOrder: WorkspaceTabId[];

        if (existing) {
          nextTabs = {
            ...state.tabs,
            [tab.id]: {
              ...existing,
              href: tab.href,
              title: tab.title,
              closable: tab.closable ?? existing.closable,
              keepAlive: tab.keepAlive ?? existing.keepAlive,
              lastVisitedAt: Date.now()
            }
          };
          nextActiveId = tab.id;
          nextLifecycleSnapshots = state.lifecycleSnapshots;
          nextOpenedOrder = state.openedOrder;
        } else {
          const nextTab: WorkspaceTab = {
            id: tab.id,
            href: tab.href,
            title: tab.title,
            closable: tab.closable ?? true,
            keepAlive: tab.keepAlive ?? false,
            lastVisitedAt: Date.now()
          };
          nextTabs = { ...state.tabs, [tab.id]: nextTab };
          nextActiveId = tab.id;
          nextLifecycleSnapshots = state.lifecycleSnapshots;
          nextOpenedOrder = normalizeOpenedOrder(
            state.openedOrder.includes(tab.id) ? state.openedOrder : [...state.openedOrder, tab.id]
          );
        }

        // Step 2: Enforce LRU eviction within the same atomic update.
        // Previously this was an off-cycle mutation (enforceLruAfterOpen) that
        // called evictInactive via a separate set() after openOrActivate returned,
        // which could cause subscriber ordering bugs.
        const keepAliveTabs = Object.values(nextTabs).filter((t) => t.keepAlive);
        if (keepAliveTabs.length > MAX_KEEPALIVE_TABS) {
          const sorted = keepAliveTabs.toSorted((a, b) => a.lastVisitedAt - b.lastVisitedAt);
          const toEvict = new Set<WorkspaceTabId>();

          for (const t of sorted) {
            if (keepAliveTabs.length - toEvict.size <= MAX_KEEPALIVE_TABS) break;
            // Never evict the tab we just opened — its lifecycle snapshot may not
            // be registered yet (registerPageDescriptor runs in a LayoutEffect),
            // so the dirty guard above would treat it as evictable.
            if (t.id === tab.id) continue;
            if (state.lifecycleSnapshots[t.id]?.dirty) continue;
            toEvict.add(t.id);
          }

          if (toEvict.size > 0) {
            // Prune evicted tabs from all state slices to prevent unbounded growth
            const kept: Record<string, WorkspaceTab> = {};
            const keptLifecycles: Record<string, WorkspacePageLifecycle> = {};
            for (const id of Object.keys(nextTabs)) {
              if (!toEvict.has(id) || isHomeId(id)) {
                kept[id] = nextTabs[id];
                if (nextLifecycleSnapshots[id]) keptLifecycles[id] = nextLifecycleSnapshots[id];
              }
            }
            nextTabs = ensureHomeTab(kept);
            nextLifecycleSnapshots = keptLifecycles;
            nextOpenedOrder = normalizeOpenedOrder(
              nextOpenedOrder.filter((id) => !toEvict.has(id) || isHomeId(id))
            );
            evictedIds = [...toEvict];
          }
        }

        return {
          tabs: nextTabs,
          activeId: nextActiveId,
          openedOrder: nextOpenedOrder,
          lifecycleSnapshots: nextLifecycleSnapshots
        };
      });

      if (evictedIds.length > 0) {
        const registry = useWorkspacePageRegistryStore.getState();
        for (const id of evictedIds) {
          dismissWorkspacePageOverlays(id);
          registry.unregisterDescriptor(id);
        }
      }
    };

    const previousActiveId = get().activeId;
    if (previousActiveId && previousActiveId !== tab.id) {
      const dismissResult = dismissWorkspacePageOverlays(previousActiveId);
      if (dismissResult.hasPendingExit) {
        void dismissResult.waitForSettled().then(() => {
          if (openOrActivateSequence === sequence) {
            commit();
          }
        });
        return;
      }
    }

    commit();
  },

  close: (id) => {
    dismissWorkspacePageOverlays(id);

    let shouldUnregister = false;

    set((state) => {
      if (isHomeId(id)) return state;
      const existingTab = state.tabs[id];
      if (!existingTab) return state;
      shouldUnregister = true;

      const { [id]: _removed, ...restTabs } = state.tabs;
      const { [id]: _removedLife, ...restLife } = state.lifecycleSnapshots;
      const nextTabs = ensureHomeTab(restTabs);
      const order = normalizeOpenedOrder(state.openedOrder.filter((oid) => oid !== id));
      const nextDisabled = new Set(state.disabledKeepAliveIds);
      nextDisabled.delete(id);

      let nextActive = state.activeId;
      if (state.activeId === id) {
        nextActive = findFallback(nextTabs, id);
      }
      return {
        tabs: nextTabs,
        activeId: nextActive,
        openedOrder: order,
        lifecycleSnapshots: restLife,
        disabledKeepAliveIds: nextDisabled
      };
    });

    if (shouldUnregister) {
      useWorkspacePageRegistryStore.getState().unregisterDescriptor(id);
    }
  },

  closeOther: (id) => {
    const currentTabs = get().tabs;
    for (const tabId of Object.keys(currentTabs)) {
      if (tabId !== id && !isHomeId(tabId)) {
        dismissWorkspacePageOverlays(tabId);
      }
    }

    let keepIds: WorkspaceTabId[] | null = null;

    set((state) => {
      const keptTab = state.tabs[id];
      if (!keptTab) return state;

      const homeTab = state.tabs[HOME_ID];
      const keepHome = id !== HOME_ID;
      const keptTabs: Record<string, WorkspaceTab> = keepHome
        ? {
            [HOME_ID]: homeTab ?? createHomeTab(),
            [id]: keptTab
          }
        : { [HOME_ID]: homeTab ?? createHomeTab() };

      const keptLifecycles: Record<string, WorkspacePageLifecycle> = {};
      if (keepHome && state.lifecycleSnapshots[HOME_ID])
        keptLifecycles[HOME_ID] = state.lifecycleSnapshots[HOME_ID];
      if (state.lifecycleSnapshots[id]) keptLifecycles[id] = state.lifecycleSnapshots[id];

      const nextDisabled = new Set(state.disabledKeepAliveIds);
      for (const oid of state.openedOrder) {
        if (oid !== id && oid !== HOME_ID) nextDisabled.delete(oid);
      }

      const activeId = id;
      keepIds = keepHome ? [HOME_ID, id] : [HOME_ID];
      return {
        tabs: keptTabs,
        activeId,
        openedOrder: normalizeOpenedOrder(keepHome ? [HOME_ID, id] : [HOME_ID]),
        lifecycleSnapshots: keptLifecycles,
        disabledKeepAliveIds: nextDisabled
      };
    });

    if (keepIds) {
      useWorkspacePageRegistryStore.getState().retainDescriptors(keepIds);
    }
  },

  closeAll: () => {
    const currentTabs = get().tabs;
    for (const tabId of Object.keys(currentTabs)) {
      if (!isHomeId(tabId)) {
        dismissWorkspacePageOverlays(tabId);
      }
    }

    set((state) => {
      const homeTab = state.tabs[HOME_ID];
      if (homeTab) {
        const keptLifecycles: Record<string, WorkspacePageLifecycle> = {};
        if (state.lifecycleSnapshots[HOME_ID])
          keptLifecycles[HOME_ID] = state.lifecycleSnapshots[HOME_ID];

        return {
          tabs: { [HOME_ID]: homeTab },
          activeId: HOME_ID,
          openedOrder: normalizeOpenedOrder([HOME_ID]),
          lifecycleSnapshots: keptLifecycles,
          disabledKeepAliveIds: new Set()
        };
      }
      const nextHomeTab = createHomeTab();
      return {
        tabs: { [HOME_ID]: nextHomeTab },
        activeId: HOME_ID,
        openedOrder: normalizeOpenedOrder([HOME_ID]),
        lifecycleSnapshots: {},
        disabledKeepAliveIds: new Set()
      };
    });

    useWorkspacePageRegistryStore.getState().retainDescriptors([HOME_ID]);
  },

  touch: (id) =>
    set((state) => {
      const tab = state.tabs[id];
      if (!tab) return state;
      return { tabs: { ...state.tabs, [id]: { ...tab, lastVisitedAt: Date.now() } } };
    }),

  evictInactive: (keepAliveIds) => {
    const currentTabs = get().tabs;
    for (const tabId of Object.keys(currentTabs)) {
      if (!keepAliveIds.has(tabId) && !isHomeId(tabId)) {
        dismissWorkspacePageOverlays(tabId);
      }
    }

    let keepIds: WorkspaceTabId[] = [];

    set((state) => {
      const kept: Record<string, WorkspaceTab> = {};
      for (const id of Object.keys(state.tabs)) {
        if (keepAliveIds.has(id) || isHomeId(id)) kept[id] = state.tabs[id];
      }
      const tabs = ensureHomeTab(kept);
      keepIds = Object.keys(tabs);
      return {
        tabs,
        openedOrder: normalizeOpenedOrder(
          state.openedOrder.filter((id) => keepAliveIds.has(id) || isHomeId(id))
        )
      };
    });

    useWorkspacePageRegistryStore.getState().retainDescriptors(keepIds);
  },

  disableKeepAlive: (id) =>
    set((state) => {
      const next = new Set(state.disabledKeepAliveIds);
      next.add(id);
      return { disabledKeepAliveIds: next };
    }),

  enableKeepAlive: (id) =>
    set((state) => {
      const next = new Set(state.disabledKeepAliveIds);
      next.delete(id);
      return { disabledKeepAliveIds: next };
    }),

  getSnapshot: () => {
    const { tabs, activeId, openedOrder } = get();
    return { tabs: Object.values(tabs), activeId, openedOrder };
  },

  // ─── V2 page descriptor lifecycle ───

  registerPageDescriptor: (tabId, descriptor) => {
    useWorkspacePageRegistryStore.getState().registerDescriptor(tabId, descriptor);

    set((state) => {
      const existingLifecycle = state.lifecycleSnapshots[tabId];

      const nextLifecycle = existingLifecycle ?? makeDefaultLifecycle(descriptor.initialTitle);
      const lifecycleSnapshots = existingLifecycle
        ? state.lifecycleSnapshots
        : { ...state.lifecycleSnapshots, [tabId]: nextLifecycle };

      if (lifecycleSnapshots === state.lifecycleSnapshots) {
        return state;
      }

      return {
        lifecycleSnapshots
      };
    });
  },

  unregisterPageDescriptor: (tabId) => {
    useWorkspacePageRegistryStore.getState().unregisterDescriptor(tabId);

    set((state) => {
      const { [tabId]: _life, ...restLife } = state.lifecycleSnapshots;
      return { lifecycleSnapshots: restLife };
    });
  },

  updateLifecycle: (tabId, patch) =>
    set((state) => {
      const existing = state.lifecycleSnapshots[tabId];
      const nextLife: WorkspacePageLifecycle = {
        title: patch.title ?? existing?.title ?? '',
        dirty: patch.dirty ?? existing?.dirty ?? false,
        closeGuard: patch.closeGuard !== undefined ? patch.closeGuard : existing?.closeGuard
      };

      return {
        lifecycleSnapshots: { ...state.lifecycleSnapshots, [tabId]: nextLife }
      };
    }),

  resetAll: () => {
    set(createBaseState());
    useWorkspacePageRegistryStore.getState().resetDescriptors();
    resetWorkspacePageOverlays();
  }
}));

function findFallback(
  tabs: Record<WorkspaceTabId, WorkspaceTab>,
  closedId: WorkspaceTabId
): WorkspaceTabId | null {
  const sorted = Object.values(tabs)
    .filter((t) => t.id !== closedId)
    .toSorted((a, b) => b.lastVisitedAt - a.lastVisitedAt);
  return sorted[0]?.id ?? null;
}

function createHomeTab(lastVisitedAt = Date.now()): WorkspaceTab {
  return {
    id: HOME_ID,
    href: HOME_ID,
    title: HOME_TITLE,
    closable: false,
    keepAlive: false,
    lastVisitedAt
  };
}

function ensureHomeTab(
  tabs: Record<WorkspaceTabId, WorkspaceTab>
): Record<WorkspaceTabId, WorkspaceTab> {
  if (tabs[HOME_ID]) return tabs;
  return { ...tabs, [HOME_ID]: createHomeTab() };
}

function isHomeId(id: WorkspaceTabId): boolean {
  return id === HOME_ID;
}

function normalizeOpenedOrder(ids: WorkspaceTabId[]): WorkspaceTabId[] {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.includes(HOME_ID)) return uniqueIds;
  return [HOME_ID, ...uniqueIds.filter((id) => id !== HOME_ID)];
}
