// ─── V2 page lifecycle types ───

export type WorkspaceTagId = string

export interface WorkspaceTab {
  id: WorkspaceTagId
  href: string
  title: string
  closable: boolean
  keepAlive: boolean
  lastVisitedAt: number
}

export interface WorkspaceTagSnapshot {
  tabs: WorkspaceTab[]
  activeId: WorkspaceTagId | null
  openedOrder: WorkspaceTagId[]
}

export interface WorkspaceTagOpenInput {
  id: WorkspaceTagId
  href: string
  title: string
  closable?: boolean
  keepAlive?: boolean
}

// ─── Boundary & lifecycle types ───

export interface WorkspacePageBoundaryProps {
  tabId?: string
  initialTitle: string
  keepAlive?: boolean
  closable?: boolean
  render: () => React.ReactNode
  errorFallback?: React.ReactNode
}

export interface WorkspacePageLifecyclePatch {
  title?: string
  dirty?: boolean
  closeGuard?: (context: {
    tabId: string
    reason: 'close-current' | 'close-other' | 'close-all'
  }) => boolean | Promise<boolean>
}

export interface UseWorkspacePageResult {
  tabId: string
  updateLifecycle: (patch: WorkspacePageLifecyclePatch) => void
}

export interface WorkspacePageLifecycle {
  title: string
  dirty: boolean
  closeGuard?: (context: {
    tabId: string
    reason: 'close-current' | 'close-other' | 'close-all'
  }) => boolean | Promise<boolean>
}

export interface WorkspacePageDescriptor {
  tabId: WorkspaceTagId
  initialTitle: string
  keepAlive: boolean
  closable: boolean
  render: () => React.ReactNode
  errorFallback?: React.ReactNode
}

// ─── V1 legacy types (inventory-only, superseded by V2 internal-state) ───
//
// @deprecated Kept as archival reference. Not used by flag-on or flag-off main paths.
// DO NOT import these types in new route or feature code.

export interface DataTableSearchAdapter {
  getSearch: () => Record<string, unknown>
  setSearch: (reducer: (prev: Record<string, unknown>) => Record<string, unknown>) => void
  subscribe?: (listener: () => void) => () => void
}

export interface WorkspaceRouteDefinition<TState = unknown> {
  parse: (search: Record<string, unknown>, params?: Record<string, string>) => TState
  stringify: (state: TState) => Record<string, unknown>
  buildHref: (state: TState) => string
  getPageChrome: () => { title: string; description?: string }
  refresh: () => void
}

export interface WorkspaceScreenProps<TState = unknown> {
  state: TState
  updateState: (updater: (prev: TState) => TState) => void
  definition: WorkspaceRouteDefinition<TState>
}

export interface WorkspaceScreenDescriptor<TState = unknown> {
  definition: WorkspaceRouteDefinition<TState>
  screen: React.ComponentType<WorkspaceScreenProps<TState>>
  instanceKey: string
}


