import * as React from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useWorkspaceTagStore } from '../utils/store'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'
import type { WorkspacePageBoundaryProps, WorkspacePageDescriptor } from '../types'

/**
 * WorkspacePageBoundary is the single registration point for a page instance
 * into the workspace shell.
 *
 * Flag-off: renders the page directly with zero side effects — no descriptor
 * registration, no store writes.
 *
 * Host Ownership Contract (flag-on):
 * 1. Registers a WorkspacePageDescriptor in the store during render
 * 2. Returns null — the actual page instance is mounted exclusively by ActivityHost
 * 3. Unmount does NOT cleanup the descriptor; only tab close or shell reset does
 */
export function WorkspacePageBoundary({
  tabId,
  initialTitle,
  keepAlive = true,
  closable = true,
  render,
  errorFallback,
}: WorkspacePageBoundaryProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const resolvedTabId = tabId ?? pathname
  const prevRef = React.useRef<WorkspacePageDescriptor | null>(null)

  // Always call hooks unconditionally for hook-order stability across flag toggles
  React.useEffect(() => {
    if (!isWorkspaceTabsEnabled()) return
    prevRef.current = {
      tabId: resolvedTabId,
      initialTitle,
      keepAlive,
      closable,
      render,
      errorFallback,
    }
    useWorkspaceTagStore.getState().registerPageDescriptor(resolvedTabId, {
      tabId: resolvedTabId,
      initialTitle,
      keepAlive,
      closable,
      render,
      errorFallback,
    })
  }, [resolvedTabId, initialTitle, keepAlive, closable, errorFallback, render])

  if (!isWorkspaceTabsEnabled()) {
    return <>{render()}</>
  }

  const descriptor: WorkspacePageDescriptor = {
    tabId: resolvedTabId,
    initialTitle,
    keepAlive,
    closable,
    render,
    errorFallback,
  }

  // Register synchronously during render so the viewport can pick up the
  // descriptor in the same React render cycle — no blank viewport frame.
  if (
    !prevRef.current ||
    prevRef.current.tabId !== descriptor.tabId ||
    prevRef.current.keepAlive !== descriptor.keepAlive ||
    prevRef.current.closable !== descriptor.closable
  ) {
    prevRef.current = descriptor
    useWorkspaceTagStore.getState().registerPageDescriptor(resolvedTabId, descriptor)
  }

  return null
}
