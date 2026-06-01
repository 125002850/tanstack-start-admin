import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkspaceTabStore } from './store';
import type { WorkspaceTabOpenInput, WorkspacePageDescriptor } from '../types';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { MAX_KEEPALIVE_TABS } from '@/config/workspace-tabs';

const HOME_ID = resolveDashboardHomeHref();

function makeTab(overrides: Partial<WorkspaceTabOpenInput> = {}): WorkspaceTabOpenInput {
  return {
    id: 'tab-1',
    href: '/dashboard/overview',
    title: 'Overview',
    closable: true,
    keepAlive: false,
    ...overrides
  };
}

function makeDescriptor(overrides: Partial<WorkspacePageDescriptor> = {}): WorkspacePageDescriptor {
  return {
    tabId: 'tab-1',
    initialTitle: 'Overview',
    keepAlive: false,
    closable: true,
    render: () => null,
    ...overrides
  };
}

function resetStore() {
  useWorkspaceTabStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    pageDescriptors: {},
    lifecycleSnapshots: {}
  });
}

describe('workspace-tags store', () => {
  beforeEach(resetStore);

  describe('base state', () => {
    it('resetAll restores the persistent home tab', () => {
      const store = useWorkspaceTabStore.getState();

      store.resetAll();

      const state = useWorkspaceTabStore.getState();
      expect(Object.keys(state.tabs)).toEqual([HOME_ID]);
      expect(state.tabs[HOME_ID]).toMatchObject({
        id: HOME_ID,
        href: HOME_ID,
        title: '仪表盘',
        closable: false,
        keepAlive: false
      });
      expect(state.activeId).toBe(HOME_ID);
      expect(state.openedOrder).toEqual([HOME_ID]);
    });
  });

  describe('openOrActivate', () => {
    it('adds a new tab and sets it active', () => {
      const tab = makeTab();
      useWorkspaceTabStore.getState().openOrActivate(tab);
      const state = useWorkspaceTabStore.getState();
      expect(state.tabs[tab.id]).toBeDefined();
      expect(state.activeId).toBe(tab.id);
      expect(state.openedOrder).toContain(tab.id);
    });

    it('activates an existing tab without duplicating', () => {
      const tab = makeTab();
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(tab);
      store.openOrActivate(tab);
      const state = useWorkspaceTabStore.getState();
      expect(state.openedOrder.length).toBe(1);
      expect(state.activeId).toBe(tab.id);
    });

    it('updates href and title on re-activation', () => {
      const tab = makeTab({ href: '/dashboard/product' });
      useWorkspaceTabStore.getState().openOrActivate(tab);
      useWorkspaceTabStore
        .getState()
        .openOrActivate(
          makeTab({ id: tab.id, href: '/dashboard/product?page=2', title: 'Updated' })
        );
      const updated = useWorkspaceTabStore.getState().tabs[tab.id];
      expect(updated.href).toBe('/dashboard/product?page=2');
      expect(updated.title).toBe('Updated');
    });

    it('updates lastVisitedAt on re-activation', () => {
      const tab = makeTab();
      useWorkspaceTabStore.getState().openOrActivate(tab);
      const firstTouch = useWorkspaceTabStore.getState().tabs[tab.id].lastVisitedAt;
      const start = Date.now();
      while (Date.now() === start) {
        /* wait */
      }
      useWorkspaceTabStore.getState().openOrActivate(tab);
      const secondTouch = useWorkspaceTabStore.getState().tabs[tab.id].lastVisitedAt;
      expect(secondTouch).toBeGreaterThan(firstTouch);
    });

    it('pins home tab to the first position when it is opened after other tabs', () => {
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(
        makeTab({ id: 'products', href: '/dashboard/product', title: 'Products' })
      );
      store.openOrActivate(
        makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false })
      );

      expect(useWorkspaceTabStore.getState().openedOrder).toEqual([HOME_ID, 'products']);
    });
  });

  describe('close', () => {
    it('removes the tab', () => {
      const tab = makeTab();
      useWorkspaceTabStore.getState().openOrActivate(tab);
      useWorkspaceTabStore.getState().close(tab.id);
      expect(useWorkspaceTabStore.getState().tabs[tab.id]).toBeUndefined();
    });

    it('selects the most recently visited tab as fallback', () => {
      const a = makeTab({ id: 'a', href: '/a' });
      const b = makeTab({ id: 'b', href: '/b' });
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(a);
      store.openOrActivate(b);
      useWorkspaceTabStore.getState().touch('a');
      store.close('a');
      expect(useWorkspaceTabStore.getState().activeId).toBe('b');
    });

    it('falls back to home when the last non-home tab is closed', () => {
      const tab = makeTab();
      useWorkspaceTabStore.getState().openOrActivate(tab);
      useWorkspaceTabStore.getState().close(tab.id);
      const state = useWorkspaceTabStore.getState();
      expect(state.activeId).toBe(HOME_ID);
      expect(state.tabs[HOME_ID]).toBeDefined();
    });

    it('cleans up page descriptor and lifecycle on close', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().updateLifecycle('tab-1', { dirty: true, title: 'Dirty' });
      expect(getState().pageDescriptors['tab-1']).toBeDefined();
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true);

      getState().close('tab-1');
      const state = useWorkspaceTabStore.getState();
      expect(state.pageDescriptors['tab-1']).toBeUndefined();
      expect(state.lifecycleSnapshots['tab-1']).toBeUndefined();
    });

    it('cleans up disabledKeepAlive flag on close', () => {
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(makeTab({ id: 'tab-1' }));
      store.disableKeepAlive('tab-1');
      store.close('tab-1');
      expect(useWorkspaceTabStore.getState().disabledKeepAliveIds.has('tab-1')).toBe(false);
    });

    it('does not remove home tab', () => {
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(
        makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false })
      );

      store.close(HOME_ID);

      const state = useWorkspaceTabStore.getState();
      expect(state.tabs[HOME_ID]).toBeDefined();
      expect(state.openedOrder).toEqual([HOME_ID]);
      expect(state.activeId).toBe(HOME_ID);
    });
  });

  describe('closeOther', () => {
    it('keeps home tab alongside the specified tab', () => {
      const a = makeTab({ id: 'a', href: '/a' });
      const b = makeTab({ id: 'b', href: '/b' });
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(
        makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false })
      );
      store.openOrActivate(a);
      store.openOrActivate(b);
      store.closeOther('a');
      const state = useWorkspaceTabStore.getState();
      expect(Object.keys(state.tabs).toSorted()).toEqual([HOME_ID, 'a']);
      expect(state.openedOrder).toEqual([HOME_ID, 'a']);
      expect(state.activeId).toBe('a');
    });

    it('cleans up descriptors and lifecycles of closed tabs', () => {
      const store = useWorkspaceTabStore.getState();
      store.registerPageDescriptor(
        HOME_ID,
        makeDescriptor({
          tabId: HOME_ID,
          initialTitle: '仪表盘',
          closable: false
        })
      );
      store.registerPageDescriptor('a', makeDescriptor({ tabId: 'a' }));
      store.registerPageDescriptor('b', makeDescriptor({ tabId: 'b' }));
      store.updateLifecycle('a', { dirty: true });
      store.updateLifecycle('b', { dirty: true });

      store.closeOther('a');
      const state = useWorkspaceTabStore.getState();
      expect(state.pageDescriptors[HOME_ID]).toBeDefined();
      expect(state.pageDescriptors['a']).toBeDefined();
      expect(state.pageDescriptors['b']).toBeUndefined();
      expect(state.lifecycleSnapshots[HOME_ID]).toBeDefined();
      expect(state.lifecycleSnapshots['a']).toBeDefined();
      expect(state.lifecycleSnapshots['b']).toBeUndefined();
    });
  });

  describe('closeAll', () => {
    it('keeps home tab and sets it active', () => {
      const store = useWorkspaceTabStore.getState();
      const home = makeTab({ id: HOME_ID, href: HOME_ID, closable: false, title: '仪表盘' });
      store.openOrActivate(home);
      store.openOrActivate(makeTab({ id: 'a', href: '/a' }));
      store.openOrActivate(makeTab({ id: 'b', href: '/b' }));
      store.closeAll();
      const state = useWorkspaceTabStore.getState();
      expect(Object.keys(state.tabs)).toEqual([HOME_ID]);
      expect(state.activeId).toBe(HOME_ID);
      expect(state.openedOrder).toEqual([HOME_ID]);
      expect(state.tabs[HOME_ID]).toBeDefined();
    });

    it('creates home tab if it does not exist', () => {
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(makeTab({ id: 'a', href: '/a' }));
      store.closeAll();
      const state = useWorkspaceTabStore.getState();
      expect(Object.keys(state.tabs)).toEqual([HOME_ID]);
      expect(state.activeId).toBe(HOME_ID);
      expect(state.tabs[HOME_ID]).toMatchObject({
        id: HOME_ID,
        href: HOME_ID,
        title: '仪表盘',
        closable: false,
        keepAlive: false
      });
    });

    it('cleans up all descriptors and lifecycles except home', () => {
      const store = useWorkspaceTabStore.getState();
      store.registerPageDescriptor(
        HOME_ID,
        makeDescriptor({
          tabId: HOME_ID,
          initialTitle: 'Home',
          closable: false
        })
      );
      store.registerPageDescriptor('a', makeDescriptor({ tabId: 'a' }));

      store.closeAll();
      const state = useWorkspaceTabStore.getState();
      expect(state.pageDescriptors[HOME_ID]).toBeDefined();
      expect(state.pageDescriptors['a']).toBeUndefined();
    });
  });

  describe('touch', () => {
    it('updates lastVisitedAt', () => {
      const tab = makeTab();
      useWorkspaceTabStore.getState().openOrActivate(tab);
      const prev = useWorkspaceTabStore.getState().tabs[tab.id].lastVisitedAt;
      const start = Date.now();
      while (Date.now() === start) {
        /* wait */
      }
      useWorkspaceTabStore.getState().touch(tab.id);
      expect(useWorkspaceTabStore.getState().tabs[tab.id].lastVisitedAt).toBeGreaterThan(prev);
    });

    it('is a no-op for unknown ids', () => {
      useWorkspaceTabStore.getState().touch('nonexistent');
      expect(useWorkspaceTabStore.getState().tabs['nonexistent']).toBeUndefined();
    });
  });

  describe('evictInactive', () => {
    it('removes tabs not in the keep-alive set', () => {
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(
        makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false })
      );
      store.openOrActivate(makeTab({ id: 'a', keepAlive: true }));
      store.openOrActivate(makeTab({ id: 'b', keepAlive: false }));
      store.evictInactive(new Set(['a']));
      const state = useWorkspaceTabStore.getState();
      expect(state.tabs[HOME_ID]).toBeDefined();
      expect(state.openedOrder).toEqual([HOME_ID, 'a']);
      expect(state.tabs['a']).toBeDefined();
      expect(state.tabs['b']).toBeUndefined();
    });
  });

  describe('getSnapshot', () => {
    it('returns tabs as an array with ordering', () => {
      const store = useWorkspaceTabStore.getState();
      store.openOrActivate(makeTab({ id: 'a' }));
      store.openOrActivate(
        makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false })
      );
      store.openOrActivate(makeTab({ id: 'b' }));
      const snap = store.getSnapshot();
      expect(snap.tabs).toHaveLength(3);
      expect(snap.activeId).toBe('b');
      expect(snap.openedOrder).toEqual([HOME_ID, 'a', 'b']);
    });
  });

  // ─── V2 page descriptor lifecycle ───

  function getState() {
    return useWorkspaceTabStore.getState();
  }

  describe('registerPageDescriptor', () => {
    it('stores the page descriptor', () => {
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Test' })
      );
      expect(getState().pageDescriptors['tab-1']).toBeDefined();
      expect(getState().pageDescriptors['tab-1']?.initialTitle).toBe('Test');
    });

    it('creates a tab for the registered descriptor', () => {
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', keepAlive: true })
      );
      const tab = getState().tabs['tab-1'];
      expect(tab).toBeDefined();
      expect(tab?.keepAlive).toBe(true);
      expect(tab?.closable).toBe(true);
    });

    it('sets the registered tab as active', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      expect(getState().activeId).toBe('tab-1');
    });

    it('creates a default lifecycle snapshot', () => {
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'My Page' })
      );
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('My Page');
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(false);
    });

    it('preserves existing lifecycle title when re-registering', () => {
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial' })
      );
      getState().updateLifecycle('tab-1', { title: 'Updated by page' });
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial Again' })
      );
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('Updated by page');
    });

    it('preserves dirty and closeGuard when re-registering', () => {
      const closeGuard = vi.fn(() => true);

      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial' })
      );
      getState().updateLifecycle('tab-1', { dirty: true, closeGuard });
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial Again' })
      );

      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true);
      expect(getState().lifecycleSnapshots['tab-1']?.closeGuard).toBe(closeGuard);
    });

    it('preserves the existing href when re-registering an open tab', () => {
      const store = getState();
      store.openOrActivate(
        makeTab({
          id: 'tab-1',
          href: '/dashboard/product?page=2',
          title: 'Products'
        })
      );

      store.registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Products' })
      );

      expect(getState().tabs['tab-1']?.href).toBe('/dashboard/product?page=2');
    });

    it('does not duplicate tab in openedOrder when re-registered', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Changed' })
      );
      const entries = getState().openedOrder.filter((id) => id === 'tab-1');
      expect(entries).toHaveLength(1);
    });

    it('keeps home tab first when it is registered after other pages', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().registerPageDescriptor(
        HOME_ID,
        makeDescriptor({
          tabId: HOME_ID,
          initialTitle: '仪表盘',
          closable: false
        })
      );

      expect(getState().openedOrder).toEqual([HOME_ID, 'tab-1']);
    });

    it('works when called during render (idempotent)', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      expect(getState().openedOrder.filter((id) => id === 'tab-1')).toHaveLength(1);
      expect(getState().tabs['tab-1']).toBeDefined();
    });
  });

  describe('unregisterPageDescriptor', () => {
    it('removes descriptor and lifecycle without closing tab', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().unregisterPageDescriptor('tab-1');
      expect(getState().pageDescriptors['tab-1']).toBeUndefined();
      expect(getState().lifecycleSnapshots['tab-1']).toBeUndefined();
      expect(getState().tabs['tab-1']).toBeDefined();
    });
  });

  describe('updateLifecycle', () => {
    it('updates title and syncs to tab', () => {
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial' })
      );
      getState().updateLifecycle('tab-1', { title: 'New Title' });
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('New Title');
      expect(getState().tabs['tab-1']?.title).toBe('New Title');
    });

    it('updates dirty flag', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().updateLifecycle('tab-1', { dirty: true });
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true);
      getState().updateLifecycle('tab-1', { dirty: false });
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(false);
    });

    it('stores closeGuard function', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      const guard = vi.fn(() => true);
      getState().updateLifecycle('tab-1', { closeGuard: guard });
      expect(getState().lifecycleSnapshots['tab-1']?.closeGuard).toBe(guard);
    });

    it('is a no-op for unknown tabs (no crash)', () => {
      expect(() => getState().updateLifecycle('nonexistent', { title: 'x' })).not.toThrow();
    });

    it('preserves existing values when patch is partial', () => {
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'A' })
      );
      getState().updateLifecycle('tab-1', { dirty: true });
      getState().updateLifecycle('tab-1', { title: 'B' });
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true);
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('B');
    });
  });

  describe('resetAll', () => {
    it('restores home and clears descriptors and lifecycles', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }));
      getState().registerPageDescriptor('tab-2', makeDescriptor({ tabId: 'tab-2' }));
      getState().updateLifecycle('tab-1', { dirty: true });

      getState().resetAll();
      const state = getState();
      expect(Object.keys(state.tabs)).toEqual([HOME_ID]);
      expect(state.activeId).toBe(HOME_ID);
      expect(state.openedOrder).toEqual([HOME_ID]);
      expect(Object.keys(state.pageDescriptors)).toHaveLength(0);
      expect(Object.keys(state.lifecycleSnapshots)).toHaveLength(0);
    });
  });

  // ─── LRU eviction (inlined in openOrActivate) ───

  describe('LRU eviction (inlined in openOrActivate)', () => {
    it('evicts oldest keep-alive tab when exceeding MAX_KEEPALIVE_TABS', () => {
      // Build state with MAX_KEEPALIVE_TABS keep-alive tabs, each with staggered lastVisitedAt
      const baseTime = 1000000;
      const tabs: Record<
        string,
        {
          id: string;
          href: string;
          title: string;
          closable: boolean;
          keepAlive: boolean;
          lastVisitedAt: number;
        }
      > = {
        [HOME_ID]: {
          id: HOME_ID,
          href: HOME_ID,
          title: '仪表盘',
          closable: false,
          keepAlive: false,
          lastVisitedAt: baseTime
        }
      };
      const order = [HOME_ID];

      for (let i = 0; i < MAX_KEEPALIVE_TABS; i++) {
        const id = `keep-${i}`;
        tabs[id] = {
          id,
          href: `/${id}`,
          title: id,
          closable: true,
          keepAlive: true,
          lastVisitedAt: baseTime + (i + 1) * 1000
        };
        order.push(id);
      }

      useWorkspaceTabStore.setState({
        tabs,
        openedOrder: order,
        activeId: `keep-${MAX_KEEPALIVE_TABS - 1}`,
        disabledKeepAliveIds: new Set(),
        pageDescriptors: {},
        lifecycleSnapshots: {}
      });

      // Open one more keep-alive tab to trigger eviction
      getState().openOrActivate(
        makeTab({ id: 'overflow', href: '/overflow', title: 'Overflow', keepAlive: true })
      );

      const state = getState();
      // keep-0 is the oldest and should be evicted
      expect(state.tabs['keep-0']).toBeUndefined();
      // All other keep-alive tabs should be preserved
      for (let i = 1; i < MAX_KEEPALIVE_TABS; i++) {
        expect(state.tabs[`keep-${i}`]).toBeDefined();
      }
      // overflow should be present
      expect(state.tabs['overflow']).toBeDefined();
      // Home tab should be preserved
      expect(state.tabs[HOME_ID]).toBeDefined();
    });

    it('preserves dirty keep-alive tabs during eviction', () => {
      const store = getState();

      // Register MAX_KEEPALIVE_TABS keep-alive page descriptors
      for (let i = 0; i < MAX_KEEPALIVE_TABS; i++) {
        store.registerPageDescriptor(
          `keep-${i}`,
          makeDescriptor({
            tabId: `keep-${i}`,
            keepAlive: true,
            initialTitle: `Keep ${i}`
          })
        );
      }

      // Mark the first two (oldest) as dirty
      store.updateLifecycle('keep-0', { dirty: true });
      store.updateLifecycle('keep-1', { dirty: true });

      // Open one more keep-alive tab to exceed the limit (must use openOrActivate to trigger eviction)
      store.openOrActivate(
        makeTab({ id: 'overflow', href: '/overflow', title: 'Overflow', keepAlive: true })
      );

      const state = getState();
      // Dirty tabs should be preserved
      expect(state.tabs['keep-0']).toBeDefined();
      expect(state.tabs['keep-1']).toBeDefined();
      // The oldest clean tab (keep-2) should be evicted
      expect(state.tabs['keep-2']).toBeUndefined();
      // Remaining keep-alive tabs preserved
      for (let i = 3; i < MAX_KEEPALIVE_TABS; i++) {
        expect(state.tabs[`keep-${i}`]).toBeDefined();
      }
      // overflow and home preserved
      expect(state.tabs['overflow']).toBeDefined();
      expect(state.tabs[HOME_ID]).toBeDefined();
    });

    it('does not evict when under the keep-alive limit', () => {
      const store = getState();

      // Ensure home tab is in place
      store.openOrActivate(
        makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false })
      );

      // Open fewer than MAX_KEEPALIVE_TABS keep-alive tabs
      const count = MAX_KEEPALIVE_TABS - 1;
      for (let i = 0; i < count; i++) {
        store.openOrActivate(
          makeTab({ id: `keep-${i}`, href: `/${i}`, title: `Keep ${i}`, keepAlive: true })
        );
      }

      // All tabs should remain
      const state = getState();
      for (let i = 0; i < count; i++) {
        expect(state.tabs[`keep-${i}`]).toBeDefined();
      }
      expect(state.tabs[HOME_ID]).toBeDefined();
    });

    it('eviction runs atomically within openOrActivate', () => {
      const store = getState();

      // Open exactly MAX_KEEPALIVE_TABS keep-alive tabs
      for (let i = 0; i < MAX_KEEPALIVE_TABS; i++) {
        store.openOrActivate(
          makeTab({ id: `keep-${i}`, href: `/${i}`, title: `Keep ${i}`, keepAlive: true })
        );
      }

      // Subscribe to store updates
      const listener = vi.fn();
      const unsub = useWorkspaceTabStore.subscribe(listener);

      // Open one more keep-alive tab — should evict and open in ONE state update
      store.openOrActivate(
        makeTab({ id: 'overflow', href: '/overflow', title: 'Overflow', keepAlive: true })
      );

      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });

    it('preserves non-keep-alive tabs during eviction (only keep-alive tabs count toward limit)', () => {
      // Build state with MAX_KEEPALIVE_TABS keep-alive tabs plus several non-keep-alive tabs
      const baseTime = 1000000;
      const tabs: Record<
        string,
        {
          id: string;
          href: string;
          title: string;
          closable: boolean;
          keepAlive: boolean;
          lastVisitedAt: number;
        }
      > = {
        [HOME_ID]: {
          id: HOME_ID,
          href: HOME_ID,
          title: '仪表盘',
          closable: false,
          keepAlive: false,
          lastVisitedAt: baseTime
        }
      };
      const order = [HOME_ID];

      for (let i = 0; i < MAX_KEEPALIVE_TABS; i++) {
        const id = `keep-${i}`;
        tabs[id] = {
          id,
          href: `/${id}`,
          title: id,
          closable: true,
          keepAlive: true,
          lastVisitedAt: baseTime + (i + 1) * 1000
        };
        order.push(id);
      }

      // Add several non-keep-alive tabs (they should not count toward the limit)
      const normalCount = 5;
      for (let i = 0; i < normalCount; i++) {
        const id = `normal-${i}`;
        tabs[id] = {
          id,
          href: `/${id}`,
          title: id,
          closable: true,
          keepAlive: false,
          lastVisitedAt: baseTime + (MAX_KEEPALIVE_TABS + i + 1) * 1000
        };
        order.push(id);
      }

      useWorkspaceTabStore.setState({
        tabs,
        openedOrder: order,
        activeId: `normal-${normalCount - 1}`,
        disabledKeepAliveIds: new Set(),
        pageDescriptors: {},
        lifecycleSnapshots: {}
      });

      // Open one more keep-alive tab to trigger eviction
      getState().openOrActivate(
        makeTab({ id: 'overflow', href: '/overflow', title: 'Overflow', keepAlive: true })
      );

      const state = getState();
      // keep-0 (oldest keep-alive) should be evicted
      expect(state.tabs['keep-0']).toBeUndefined();
      // Other keep-alive tabs preserved
      for (let i = 1; i < MAX_KEEPALIVE_TABS; i++) {
        expect(state.tabs[`keep-${i}`]).toBeDefined();
      }
      // All non-keep-alive tabs preserved
      for (let i = 0; i < normalCount; i++) {
        expect(state.tabs[`normal-${i}`]).toBeDefined();
      }
      // overflow and home preserved
      expect(state.tabs['overflow']).toBeDefined();
      expect(state.tabs[HOME_ID]).toBeDefined();
    });
  });
});
