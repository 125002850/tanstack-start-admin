import type { WorkspaceTagId, WorkspaceScreenDescriptor } from '../types'

type Registry = Map<WorkspaceTagId, WorkspaceScreenDescriptor>

let registry: Registry = new Map()

export const workspaceRegistry = {
  register(id: WorkspaceTagId, descriptor: WorkspaceScreenDescriptor): void {
    registry.set(id, descriptor)
  },

  unregister(id: WorkspaceTagId): void {
    registry.delete(id)
  },

  get(id: WorkspaceTagId): WorkspaceScreenDescriptor | undefined {
    return registry.get(id)
  },

  has(id: WorkspaceTagId): boolean {
    return registry.has(id)
  },

  getAll(): Map<WorkspaceTagId, WorkspaceScreenDescriptor> {
    return new Map(registry)
  },

  /** Reset module-level singleton — for test teardown only. */
  reset(): void {
    registry = new Map()
  },
}
