import * as React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useWorkspaceTagStore } from '../utils/store'
import { useWorkspacePage, WorkspacePageContext } from './use-workspace-page'
import type { WorkspacePageDescriptor, WorkspacePageLifecyclePatch } from '../types'

function makeDescriptor(tabId: string): WorkspacePageDescriptor {
  return {
    tabId,
    initialTitle: 'Test Page',
    keepAlive: true,
    closable: true,
    render: () => null,
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

function TestHarness() {
  const { tabId, updateLifecycle } = useWorkspacePage()
  return React.createElement('div', { 'data-testid': 'harness' }, [
    React.createElement('span', { key: 'id', 'data-testid': 'tab-id' }, tabId),
    React.createElement('button', {
      key: 'title',
      'data-testid': 'set-title',
      onClick: () => updateLifecycle({ title: 'Updated Title' }),
    }, 'Set Title'),
    React.createElement('button', {
      key: 'dirty',
      'data-testid': 'set-dirty',
      onClick: () => updateLifecycle({ dirty: true }),
    }, 'Set Dirty'),
    React.createElement('button', {
      key: 'guard',
      'data-testid': 'set-guard',
      onClick: () => updateLifecycle({ closeGuard: () => true }),
    }, 'Set Guard'),
  ])
}

function makeUpdateLifecycle(tabId: string) {
  return (patch: WorkspacePageLifecyclePatch) => {
    useWorkspaceTagStore.getState().updateLifecycle(tabId, patch)
  }
}

function renderWithProvider(tabId: string) {
  const updateLifecycle = makeUpdateLifecycle(tabId)
  return render(
    React.createElement(WorkspacePageContext.Provider, { value: { tabId, updateLifecycle } },
      React.createElement(TestHarness),
    ),
  )
}

describe('useWorkspacePage', () => {
  beforeEach(() => {
    resetStore()
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it('returns tabId from context (injected by ActivityHost)', () => {
    const { getByTestId } = renderWithProvider('/dashboard/users')
    expect(getByTestId('tab-id').textContent).toBe('/dashboard/users')
  })

  it('returns empty string and no-op updateLifecycle when no provider is in the tree', () => {
    const { getByTestId } = render(React.createElement(TestHarness))
    expect(getByTestId('tab-id').textContent).toBe('')
    // updateLifecycle is a no-op — clicking should not throw
    act(() => {
      getByTestId('set-title').click()
    })
  })

  it('no-op updateLifecycle when context is null does not write to store', () => {
    const store = useWorkspaceTagStore.getState()
    store.registerPageDescriptor('/dashboard/test-page', makeDescriptor('/dashboard/test-page'))

    const { getByTestId } = render(React.createElement(TestHarness))
    act(() => {
      getByTestId('set-title').click()
    })

    const lifecycle = useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/test-page']
    expect(lifecycle?.title).not.toBe('Updated Title')
  })

  it('updateLifecycle updates title in store', () => {
    const store = useWorkspaceTagStore.getState()
    store.registerPageDescriptor('/dashboard/test-page', makeDescriptor('/dashboard/test-page'))

    const { getByTestId } = renderWithProvider('/dashboard/test-page')
    act(() => {
      getByTestId('set-title').click()
    })

    const lifecycle = useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/test-page']
    expect(lifecycle?.title).toBe('Updated Title')
    expect(useWorkspaceTagStore.getState().tabs['/dashboard/test-page']?.title).toBe('Updated Title')
  })

  it('updateLifecycle updates dirty flag in store', () => {
    const store = useWorkspaceTagStore.getState()
    store.registerPageDescriptor('/dashboard/test-page', makeDescriptor('/dashboard/test-page'))

    const { getByTestId } = renderWithProvider('/dashboard/test-page')
    act(() => {
      getByTestId('set-dirty').click()
    })

    const lifecycle = useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/test-page']
    expect(lifecycle?.dirty).toBe(true)
  })

  it('updateLifecycle stores closeGuard', () => {
    const store = useWorkspaceTagStore.getState()
    store.registerPageDescriptor('/dashboard/test-page', makeDescriptor('/dashboard/test-page'))

    const { getByTestId } = renderWithProvider('/dashboard/test-page')
    act(() => {
      getByTestId('set-guard').click()
    })

    const lifecycle = useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/test-page']
    expect(lifecycle?.closeGuard).toBeDefined()
    expect(typeof lifecycle?.closeGuard).toBe('function')
  })

  it('different provider values target different tabs', () => {
    const s = useWorkspaceTagStore.getState()
    s.registerPageDescriptor('/dashboard/page-a', makeDescriptor('/dashboard/page-a'))
    s.registerPageDescriptor('/dashboard/page-b', makeDescriptor('/dashboard/page-b'))

    const { getByTestId: getA } = renderWithProvider('/dashboard/page-a')
    act(() => {
      getA('set-title').click()
    })
    expect(useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/page-a']?.title).toBe('Updated Title')
    expect(useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/page-b']?.title).not.toBe('Updated Title')

    cleanup()

    const { getByTestId: getB } = renderWithProvider('/dashboard/page-b')
    act(() => {
      getB('set-dirty').click()
    })
    expect(useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/page-b']?.dirty).toBe(true)
  })

  it('hidden keep-alive page still writes lifecycle to its own tab', () => {
    const s = useWorkspaceTagStore.getState()
    s.registerPageDescriptor('/dashboard/products', makeDescriptor('/dashboard/products'))
    s.registerPageDescriptor('/dashboard/users', makeDescriptor('/dashboard/users'))

    // Products is hidden (keep-alive) — provider still injects /dashboard/products
    const { getByTestId } = renderWithProvider('/dashboard/products')
    act(() => {
      getByTestId('set-title').click()
    })

    expect(useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/products']?.title).toBe('Updated Title')
    expect(useWorkspaceTagStore.getState().lifecycleSnapshots['/dashboard/users']?.title).not.toBe('Updated Title')
  })
})
