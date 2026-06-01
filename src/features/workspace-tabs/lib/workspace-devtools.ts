import { useEffect, useRef } from 'react'
import { useWorkspaceTabStore } from '../utils/store'

const DEVTOOLS_KEY = '__WORKSPACE_DEVTOOLS__'

interface WorkspaceDevtoolsSnapshot {
  tabs: Array<{ id: string; title: string; keepAlive: boolean; closable: boolean }>
  activeId: string | null
  openedOrder: string[]
  timestamp: number
}

function isDev(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env as Record<string, unknown>).DEV === true
    }
  } catch {
    // import.meta unavailable
  }
  return false
}

function isActive(enabled: boolean): boolean {
  return isDev() && enabled
}

function logSnapshot(label: string, snapshot: WorkspaceDevtoolsSnapshot) {
  // oxlint-disable-next-line no-console -- dev-only diagnostic output
  console.debug(
    `[workspace-devtools] ${label}`,
    `active=${snapshot.activeId ?? '(none)'}`,
    `tabs=${snapshot.tabs.length}`,
    snapshot,
  )
}

function storeToSnapshot(): WorkspaceDevtoolsSnapshot {
  const state = useWorkspaceTabStore.getState()
  return {
    tabs: Object.values(state.tabs).map((t) => ({
      id: t.id,
      title: t.title,
      keepAlive: t.keepAlive,
      closable: t.closable,
    })),
    activeId: state.activeId,
    openedOrder: state.openedOrder,
    timestamp: Date.now(),
  }
}

/**
 * Dev-only hook that subscribes to workspace tag store changes and logs
 * snapshots to the console. Also attaches a `window.__WORKSPACE_DEVTOOLS__`
 * bridge for on-demand inspection.
 *
 * Always call this hook unconditionally — it internally no-ops when
 * `!enabled` or `!isDev()`, so hook order stays consistent across
 * environments and across flag toggles.
 */
export function useWorkspaceDevtools(enabled = true) {
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!isActive(enabled)) return
    if (mountedRef.current) return
    mountedRef.current = true

    // Attach window bridge for manual inspection
    const bridge = {
      snapshot: () => {
        const snap = storeToSnapshot()
        logSnapshot('manual snapshot', snap)
        return snap
      },
      getStore: () => useWorkspaceTabStore.getState(),
    }
    ;(window as unknown as Record<string, unknown>)[DEVTOOLS_KEY] = bridge

    // oxlint-disable-next-line no-console -- dev-only diagnostic output
    console.debug(
      '[workspace-devtools] attached — use window.__WORKSPACE_DEVTOOLS__.snapshot() to inspect store',
    )
  }, [enabled])

  // Subscribe to store changes and log deltas
  useEffect(() => {
    if (!isActive(enabled)) return

    const unsub = useWorkspaceTabStore.subscribe((state, prev) => {
      const prevCount = Object.keys(prev.tabs).length
      const nextCount = Object.keys(state.tabs).length
      const activeChanged = prev.activeId !== state.activeId

      if (prevCount !== nextCount || activeChanged) {
        logSnapshot(
          activeChanged
            ? `active: ${prev.activeId ?? '(none)'} → ${state.activeId ?? '(none)'}`
            : `tabs: ${prevCount} → ${nextCount}`,
          storeToSnapshot(),
        )
      }
    })

    return unsub
  }, [enabled])
}
