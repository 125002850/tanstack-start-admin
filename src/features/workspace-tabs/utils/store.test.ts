import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkspaceTagStore } from './store'
import type {
  WorkspaceTagOpenInput,
  WorkspacePageDescriptor,
} from '../types'
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home'

const HOME_ID = resolveDashboardHomeHref()

function makeTab(overrides: Partial<WorkspaceTagOpenInput> = {}): WorkspaceTagOpenInput {
  return {
    id: 'tab-1',
    href: '/dashboard/overview',
    title: 'Overview',
    closable: true,
    keepAlive: false,
    ...overrides,
  }
}

function makeDescriptor(overrides: Partial<WorkspacePageDescriptor> = {}): WorkspacePageDescriptor {
  return {
    tabId: 'tab-1',
    initialTitle: 'Overview',
    keepAlive: false,
    closable: true,
    render: () => null,
    ...overrides,
  }
}

function resetStore() {
  useWorkspaceTagStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    pageDescriptors: {},
    lifecycleSnapshots: {},
  })
}

describe('workspace-tags store', () => {
  beforeEach(resetStore)

  describe('base state', () => {
    it('resetAll restores the persistent home tab', () => {
      const store = useWorkspaceTagStore.getState()

      store.resetAll()

      const state = useWorkspaceTagStore.getState()
      expect(Object.keys(state.tabs)).toEqual([HOME_ID])
      expect(state.tabs[HOME_ID]).toMatchObject({
        id: HOME_ID,
        href: HOME_ID,
        title: '仪表盘',
        closable: false,
        keepAlive: false,
      })
      expect(state.activeId).toBe(HOME_ID)
      expect(state.openedOrder).toEqual([HOME_ID])
    })
  })

  describe('openOrActivate', () => {
    it('adds a new tab and sets it active', () => {
      const tab = makeTab()
      useWorkspaceTagStore.getState().openOrActivate(tab)
      const state = useWorkspaceTagStore.getState()
      expect(state.tabs[tab.id]).toBeDefined()
      expect(state.activeId).toBe(tab.id)
      expect(state.openedOrder).toContain(tab.id)
    })

    it('activates an existing tab without duplicating', () => {
      const tab = makeTab()
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(tab)
      store.openOrActivate(tab)
      const state = useWorkspaceTagStore.getState()
      expect(state.openedOrder.length).toBe(1)
      expect(state.activeId).toBe(tab.id)
    })

    it('updates href and title on re-activation', () => {
      const tab = makeTab({ href: '/dashboard/product' })
      useWorkspaceTagStore.getState().openOrActivate(tab)
      useWorkspaceTagStore.getState().openOrActivate(makeTab({ id: tab.id, href: '/dashboard/product?page=2', title: 'Updated' }))
      const updated = useWorkspaceTagStore.getState().tabs[tab.id]
      expect(updated.href).toBe('/dashboard/product?page=2')
      expect(updated.title).toBe('Updated')
    })

    it('updates lastVisitedAt on re-activation', () => {
      const tab = makeTab()
      useWorkspaceTagStore.getState().openOrActivate(tab)
      const firstTouch = useWorkspaceTagStore.getState().tabs[tab.id].lastVisitedAt
      const start = Date.now()
      while (Date.now() === start) { /* wait */ }
      useWorkspaceTagStore.getState().openOrActivate(tab)
      const secondTouch = useWorkspaceTagStore.getState().tabs[tab.id].lastVisitedAt
      expect(secondTouch).toBeGreaterThan(firstTouch)
    })

    it('pins home tab to the first position when it is opened after other tabs', () => {
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: 'products', href: '/dashboard/product', title: 'Products' }))
      store.openOrActivate(makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false }))

      expect(useWorkspaceTagStore.getState().openedOrder).toEqual([HOME_ID, 'products'])
    })
  })

  describe('close', () => {
    it('removes the tab', () => {
      const tab = makeTab()
      useWorkspaceTagStore.getState().openOrActivate(tab)
      useWorkspaceTagStore.getState().close(tab.id)
      expect(useWorkspaceTagStore.getState().tabs[tab.id]).toBeUndefined()
    })

    it('selects the most recently visited tab as fallback', () => {
      const a = makeTab({ id: 'a', href: '/a' })
      const b = makeTab({ id: 'b', href: '/b' })
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(a)
      store.openOrActivate(b)
      useWorkspaceTagStore.getState().touch('a')
      store.close('a')
      expect(useWorkspaceTagStore.getState().activeId).toBe('b')
    })

    it('falls back to home when the last non-home tab is closed', () => {
      const tab = makeTab()
      useWorkspaceTagStore.getState().openOrActivate(tab)
      useWorkspaceTagStore.getState().close(tab.id)
      const state = useWorkspaceTagStore.getState()
      expect(state.activeId).toBe(HOME_ID)
      expect(state.tabs[HOME_ID]).toBeDefined()
    })

    it('cleans up page descriptor and lifecycle on close', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().updateLifecycle('tab-1', { dirty: true, title: 'Dirty' })
      expect(getState().pageDescriptors['tab-1']).toBeDefined()
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true)

      getState().close('tab-1')
      const state = useWorkspaceTagStore.getState()
      expect(state.pageDescriptors['tab-1']).toBeUndefined()
      expect(state.lifecycleSnapshots['tab-1']).toBeUndefined()
    })

    it('cleans up disabledKeepAlive flag on close', () => {
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: 'tab-1' }))
      store.disableKeepAlive('tab-1')
      store.close('tab-1')
      expect(useWorkspaceTagStore.getState().disabledKeepAliveIds.has('tab-1')).toBe(false)
    })

    it('does not remove home tab', () => {
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false }))

      store.close(HOME_ID)

      const state = useWorkspaceTagStore.getState()
      expect(state.tabs[HOME_ID]).toBeDefined()
      expect(state.openedOrder).toEqual([HOME_ID])
      expect(state.activeId).toBe(HOME_ID)
    })
  })

  describe('closeOther', () => {
    it('keeps home tab alongside the specified tab', () => {
      const a = makeTab({ id: 'a', href: '/a' })
      const b = makeTab({ id: 'b', href: '/b' })
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false }))
      store.openOrActivate(a)
      store.openOrActivate(b)
      store.closeOther('a')
      const state = useWorkspaceTagStore.getState()
      expect(Object.keys(state.tabs).sort()).toEqual([HOME_ID, 'a'])
      expect(state.openedOrder).toEqual([HOME_ID, 'a'])
      expect(state.activeId).toBe('a')
    })

    it('cleans up descriptors and lifecycles of closed tabs', () => {
      const store = useWorkspaceTagStore.getState()
      store.registerPageDescriptor(HOME_ID, makeDescriptor({
        tabId: HOME_ID,
        initialTitle: '仪表盘',
        closable: false,
      }))
      store.registerPageDescriptor('a', makeDescriptor({ tabId: 'a' }))
      store.registerPageDescriptor('b', makeDescriptor({ tabId: 'b' }))
      store.updateLifecycle('a', { dirty: true })
      store.updateLifecycle('b', { dirty: true })

      store.closeOther('a')
      const state = useWorkspaceTagStore.getState()
      expect(state.pageDescriptors[HOME_ID]).toBeDefined()
      expect(state.pageDescriptors['a']).toBeDefined()
      expect(state.pageDescriptors['b']).toBeUndefined()
      expect(state.lifecycleSnapshots[HOME_ID]).toBeDefined()
      expect(state.lifecycleSnapshots['a']).toBeDefined()
      expect(state.lifecycleSnapshots['b']).toBeUndefined()
    })
  })

  describe('closeAll', () => {
    it('keeps home tab and sets it active', () => {
      const store = useWorkspaceTagStore.getState()
      const home = makeTab({ id: HOME_ID, href: HOME_ID, closable: false, title: '仪表盘' })
      store.openOrActivate(home)
      store.openOrActivate(makeTab({ id: 'a', href: '/a' }))
      store.openOrActivate(makeTab({ id: 'b', href: '/b' }))
      store.closeAll()
      const state = useWorkspaceTagStore.getState()
      expect(Object.keys(state.tabs)).toEqual([HOME_ID])
      expect(state.activeId).toBe(HOME_ID)
      expect(state.openedOrder).toEqual([HOME_ID])
      expect(state.tabs[HOME_ID]).toBeDefined()
    })

    it('creates home tab if it does not exist', () => {
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: 'a', href: '/a' }))
      store.closeAll()
      const state = useWorkspaceTagStore.getState()
      expect(Object.keys(state.tabs)).toEqual([HOME_ID])
      expect(state.activeId).toBe(HOME_ID)
      expect(state.tabs[HOME_ID]).toMatchObject({
        id: HOME_ID,
        href: HOME_ID,
        title: '仪表盘',
        closable: false,
        keepAlive: false,
      })
    })

    it('cleans up all descriptors and lifecycles except home', () => {
      const store = useWorkspaceTagStore.getState()
      store.registerPageDescriptor(HOME_ID, makeDescriptor({
        tabId: HOME_ID,
        initialTitle: 'Home',
        closable: false,
      }))
      store.registerPageDescriptor('a', makeDescriptor({ tabId: 'a' }))

      store.closeAll()
      const state = useWorkspaceTagStore.getState()
      expect(state.pageDescriptors[HOME_ID]).toBeDefined()
      expect(state.pageDescriptors['a']).toBeUndefined()
    })
  })

  describe('touch', () => {
    it('updates lastVisitedAt', () => {
      const tab = makeTab()
      useWorkspaceTagStore.getState().openOrActivate(tab)
      const prev = useWorkspaceTagStore.getState().tabs[tab.id].lastVisitedAt
      const start = Date.now()
      while (Date.now() === start) { /* wait */ }
      useWorkspaceTagStore.getState().touch(tab.id)
      expect(useWorkspaceTagStore.getState().tabs[tab.id].lastVisitedAt).toBeGreaterThan(prev)
    })

    it('is a no-op for unknown ids', () => {
      useWorkspaceTagStore.getState().touch('nonexistent')
      expect(useWorkspaceTagStore.getState().tabs['nonexistent']).toBeUndefined()
    })
  })

  describe('evictInactive', () => {
    it('removes tabs not in the keep-alive set', () => {
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false }))
      store.openOrActivate(makeTab({ id: 'a', keepAlive: true }))
      store.openOrActivate(makeTab({ id: 'b', keepAlive: false }))
      store.evictInactive(new Set(['a']))
      const state = useWorkspaceTagStore.getState()
      expect(state.tabs[HOME_ID]).toBeDefined()
      expect(state.openedOrder).toEqual([HOME_ID, 'a'])
      expect(state.tabs['a']).toBeDefined()
      expect(state.tabs['b']).toBeUndefined()
    })
  })

  describe('getSnapshot', () => {
    it('returns tabs as an array with ordering', () => {
      const store = useWorkspaceTagStore.getState()
      store.openOrActivate(makeTab({ id: 'a' }))
      store.openOrActivate(makeTab({ id: HOME_ID, href: HOME_ID, title: '仪表盘', closable: false }))
      store.openOrActivate(makeTab({ id: 'b' }))
      const snap = store.getSnapshot()
      expect(snap.tabs).toHaveLength(3)
      expect(snap.activeId).toBe('b')
      expect(snap.openedOrder).toEqual([HOME_ID, 'a', 'b'])
    })
  })

  // ─── V2 page descriptor lifecycle ───

  function getState() {
    return useWorkspaceTagStore.getState()
  }

  describe('registerPageDescriptor', () => {
    it('stores the page descriptor', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'Test' }))
      expect(getState().pageDescriptors['tab-1']).toBeDefined()
      expect(getState().pageDescriptors['tab-1']?.initialTitle).toBe('Test')
    })

    it('creates a tab for the registered descriptor', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', keepAlive: true }))
      const tab = getState().tabs['tab-1']
      expect(tab).toBeDefined()
      expect(tab?.keepAlive).toBe(true)
      expect(tab?.closable).toBe(true)
    })

    it('sets the registered tab as active', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      expect(getState().activeId).toBe('tab-1')
    })

    it('creates a default lifecycle snapshot', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'My Page' }))
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('My Page')
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(false)
    })

    it('preserves existing lifecycle title when re-registering', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial' }))
      getState().updateLifecycle('tab-1', { title: 'Updated by page' })
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial Again' }))
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('Updated by page')
    })

    it('preserves dirty and closeGuard when re-registering', () => {
      const closeGuard = vi.fn(() => true)

      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial' }),
      )
      getState().updateLifecycle('tab-1', { dirty: true, closeGuard })
      getState().registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial Again' }),
      )

      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true)
      expect(getState().lifecycleSnapshots['tab-1']?.closeGuard).toBe(closeGuard)
    })

    it('preserves the existing href when re-registering an open tab', () => {
      const store = getState()
      store.openOrActivate(
        makeTab({
          id: 'tab-1',
          href: '/dashboard/product?page=2',
          title: 'Products',
        }),
      )

      store.registerPageDescriptor(
        'tab-1',
        makeDescriptor({ tabId: 'tab-1', initialTitle: 'Products' }),
      )

      expect(getState().tabs['tab-1']?.href).toBe('/dashboard/product?page=2')
    })

    it('does not duplicate tab in openedOrder when re-registered', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'Changed' }))
      const entries = getState().openedOrder.filter((id) => id === 'tab-1')
      expect(entries).toHaveLength(1)
    })

    it('keeps home tab first when it is registered after other pages', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().registerPageDescriptor(HOME_ID, makeDescriptor({
        tabId: HOME_ID,
        initialTitle: '仪表盘',
        closable: false,
      }))

      expect(getState().openedOrder).toEqual([HOME_ID, 'tab-1'])
    })

    it('works when called during render (idempotent)', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      expect(getState().openedOrder.filter((id) => id === 'tab-1')).toHaveLength(1)
      expect(getState().tabs['tab-1']).toBeDefined()
    })
  })

  describe('unregisterPageDescriptor', () => {
    it('removes descriptor and lifecycle without closing tab', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().unregisterPageDescriptor('tab-1')
      expect(getState().pageDescriptors['tab-1']).toBeUndefined()
      expect(getState().lifecycleSnapshots['tab-1']).toBeUndefined()
      expect(getState().tabs['tab-1']).toBeDefined()
    })
  })

  describe('updateLifecycle', () => {
    it('updates title and syncs to tab', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'Initial' }))
      getState().updateLifecycle('tab-1', { title: 'New Title' })
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('New Title')
      expect(getState().tabs['tab-1']?.title).toBe('New Title')
    })

    it('updates dirty flag', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().updateLifecycle('tab-1', { dirty: true })
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true)
      getState().updateLifecycle('tab-1', { dirty: false })
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(false)
    })

    it('stores closeGuard function', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      const guard = vi.fn(() => true)
      getState().updateLifecycle('tab-1', { closeGuard: guard })
      expect(getState().lifecycleSnapshots['tab-1']?.closeGuard).toBe(guard)
    })

    it('is a no-op for unknown tabs (no crash)', () => {
      expect(() => getState().updateLifecycle('nonexistent', { title: 'x' })).not.toThrow()
    })

    it('preserves existing values when patch is partial', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1', initialTitle: 'A' }))
      getState().updateLifecycle('tab-1', { dirty: true })
      getState().updateLifecycle('tab-1', { title: 'B' })
      expect(getState().lifecycleSnapshots['tab-1']?.dirty).toBe(true)
      expect(getState().lifecycleSnapshots['tab-1']?.title).toBe('B')
    })
  })

  describe('resetAll', () => {
    it('restores home and clears descriptors and lifecycles', () => {
      getState().registerPageDescriptor('tab-1', makeDescriptor({ tabId: 'tab-1' }))
      getState().registerPageDescriptor('tab-2', makeDescriptor({ tabId: 'tab-2' }))
      getState().updateLifecycle('tab-1', { dirty: true })

      getState().resetAll()
      const state = getState()
      expect(Object.keys(state.tabs)).toEqual([HOME_ID])
      expect(state.activeId).toBe(HOME_ID)
      expect(state.openedOrder).toEqual([HOME_ID])
      expect(Object.keys(state.pageDescriptors)).toHaveLength(0)
      expect(Object.keys(state.lifecycleSnapshots)).toHaveLength(0)
    })
  })
})
