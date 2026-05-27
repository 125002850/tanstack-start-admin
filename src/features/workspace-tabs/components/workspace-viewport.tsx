import * as React from 'react'
import type { WorkspacePageDescriptor, WorkspaceScreenProps, WorkspacePageLifecyclePatch } from '../types'
import { useWorkspaceTagStore } from '../utils/store'
import { workspaceRegistry } from '../lib/workspace-registry'
import { WorkspacePageContext } from '../hooks/use-workspace-page'
import { Activity } from './activity'
import { WorkspaceSlotErrorBoundary } from './workspace-slot-error-boundary'

/**
 * WorkspaceViewport is the ActivityHost — the single owner of all page instances
 * when workspace tabs are enabled.
 *
 * V2 page descriptors (registered by WorkspacePageBoundary):
 *   - Active tab → rendered visibly
 *   - Inactive keep-alive tab → rendered via Activity hidden
 *   - Inactive non-keep-alive tab → not rendered (unmounted)
 *
 * V1 fallback (workspaceRegistry, for routes not yet migrated to V2):
 *   - Inactive keep-alive tabs → rendered via Activity hidden
 *   - Active tab is rendered by the route component directly (legacy)
 */
export function WorkspaceViewport() {
  const tabs = useWorkspaceTagStore((s) => s.tabs)
  const activeId = useWorkspaceTagStore((s) => s.activeId)
  const pageDescriptors = useWorkspaceTagStore((s) => s.pageDescriptors)
  const disabledKeepAliveIds = useWorkspaceTagStore((s) => s.disabledKeepAliveIds)

  const entries = React.useMemo(() => {
    const result: Array<{
      tagId: string
      descriptor: WorkspacePageDescriptor
      active: boolean
    }> = []

    for (const [tagId, tab] of Object.entries(tabs)) {
      const desc = pageDescriptors[tagId]
      if (!desc) continue

      const isActive = tagId === activeId
      if (isActive) {
        result.push({ tagId, descriptor: desc, active: true })
      } else if (tab.keepAlive && !disabledKeepAliveIds.has(tagId)) {
        result.push({ tagId, descriptor: desc, active: false })
      }
    }

    return result
  }, [tabs, activeId, pageDescriptors, disabledKeepAliveIds])

  // V1 fallback: inactive keep-alive tabs that only have workspaceRegistry descriptors
  const v1FallbackEntries = React.useMemo(() => {
    const result: Array<{
      tagId: string
      descriptor: ReturnType<typeof workspaceRegistry.get>
    }> = []

    for (const [tagId, tab] of Object.entries(tabs)) {
      if (pageDescriptors[tagId]) continue
      if (!tab.keepAlive) continue
      if (tagId === activeId) continue
      if (disabledKeepAliveIds.has(tagId)) continue

      const desc = workspaceRegistry.get(tagId)
      if (!desc) continue

      result.push({ tagId, descriptor: desc })
    }

    return result
  }, [tabs, activeId, pageDescriptors, disabledKeepAliveIds])

  if (entries.length === 0 && v1FallbackEntries.length === 0) return null

  return (
    <>
      {/* V2 page instances: active visible, inactive keep-alive hidden */}
      {entries.map(({ tagId, descriptor, active }) => (
        <WorkspaceSlotErrorBoundary
          key={tagId}
          tagId={tagId}
          fallback={descriptor.errorFallback ?? <DefaultWorkspaceFallback />}
        >
          <PageContextProvider tagId={tagId}>
            <PageRenderer
              render={descriptor.render}
              hidden={!active}
            />
          </PageContextProvider>
        </WorkspaceSlotErrorBoundary>
      ))}

      {/* V1 fallback: inactive keep-alive tabs from workspaceRegistry */}
      {v1FallbackEntries.map(({ tagId, descriptor }) => {
        if (!descriptor) return null
        const Screen = descriptor.screen as React.ComponentType<WorkspaceScreenProps>

        return (
          <WorkspaceSlotErrorBoundary
            key={descriptor.instanceKey}
            tagId={tagId}
            fallback={null}
          >
            <Activity mode="hidden">
              <Screen
                state={null as never}
                updateState={() => {}}
                definition={descriptor.definition}
              />
            </Activity>
          </WorkspaceSlotErrorBoundary>
        )
      })}
    </>
  )
}

function PageRenderer({
  render,
  hidden,
}: {
  render: () => React.ReactNode
  hidden: boolean
}) {
  return <Activity mode={hidden ? 'hidden' : 'visible'}>{render()}</Activity>
}

function PageContextProvider({
  tagId,
  children,
}: {
  tagId: string
  children: React.ReactNode
}) {
  const updateLifecycle = React.useCallback(
    (patch: WorkspacePageLifecyclePatch) => {
      useWorkspaceTagStore.getState().updateLifecycle(tagId, patch)
    },
    [tagId],
  )

  const value = React.useMemo(
    () => ({ tabId: tagId, updateLifecycle }),
    [tagId, updateLifecycle],
  )

  return (
    <WorkspacePageContext.Provider value={value}>
      {children}
    </WorkspacePageContext.Provider>
  )
}

function DefaultWorkspaceFallback() {
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 200,
      color: 'var(--muted-foreground)',
      fontSize: 14,
    },
  }, 'Something went wrong')
}
