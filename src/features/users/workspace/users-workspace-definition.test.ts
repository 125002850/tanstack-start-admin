/**
 * @deprecated inventory-only — tests legacy v1 workspace definition.
 * Superseded by V2 internal-state DataTable (Task V2-02B).
 * DO NOT import in new test or feature code.
 */
import { describe, it, expect, vi } from 'vitest'
import { createUsersWorkspaceDefinition } from './users-workspace-definition'
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size'
import { userKeys } from '../api/queries'
import type { QueryClient } from '@tanstack/react-query'

function mockQueryClient(): QueryClient {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as QueryClient
}

function makeDefinition(queryClient?: QueryClient) {
  return createUsersWorkspaceDefinition(queryClient ?? mockQueryClient())
}

describe('createUsersWorkspaceDefinition', () => {
  // ── parse ──────────────────────────────────────────────

  describe('parse', () => {
    it('extracts page and perPage from search params', () => {
      const def = makeDefinition()
      const state = def.parse({ page: 3, perPage: 50 }, {})
      expect(state.page).toBe(3)
      expect(state.perPage).toBe(50)
    })

    it('falls back to page=1 and default perPage when search is empty', () => {
      const def = makeDefinition()
      const state = def.parse({}, {})
      expect(state.page).toBe(1)
      expect(state.perPage).toBe(DEFAULT_DATA_TABLE_PAGE_SIZE)
    })

    it('falls back to default perPage when perPage is missing', () => {
      const def = makeDefinition()
      const state = def.parse({ page: 2 }, {})
      expect(state.page).toBe(2)
      expect(state.perPage).toBe(DEFAULT_DATA_TABLE_PAGE_SIZE)
    })

    it('extracts name filter from search', () => {
      const def = makeDefinition()
      const state = def.parse({ page: 1, perPage: 10, name: 'Alice' }, {})
      expect(state.name).toBe('Alice')
    })

    it('ignores empty string name', () => {
      const def = makeDefinition()
      const state = def.parse({ page: 1, perPage: 10, name: '' }, {})
      expect(state.name).toBeUndefined()
    })

    it('extracts role filter from search', () => {
      const def = makeDefinition()
      const state = def.parse({ page: 1, perPage: 10, role: 'Developer' }, {})
      expect(state.role).toBe('Developer')
    })

    it('extracts sort from search', () => {
      const sort = JSON.stringify([{ id: 'name', desc: true }])
      const def = makeDefinition()
      const state = def.parse({ page: 1, perPage: 10, sort }, {})
      expect(state.sort).toBe(sort)
    })

    it('ignores unknown keys in search', () => {
      const def = makeDefinition()
      const state = def.parse({ page: 1, perPage: 10, unknown: 'value' }, {})
      expect((state as Record<string, unknown>).unknown).toBeUndefined()
    })
  })

  // ── stringify ──────────────────────────────────────────

  describe('stringify', () => {
    it('round-trips a full state back to search params', () => {
      const def = makeDefinition()
      const state = { page: 2, perPage: 50, name: 'Bob', role: 'Admin' }
      const search = def.stringify(state)
      expect(search.page).toBe(2)
      expect(search.perPage).toBe(50)
      expect(search.name).toBe('Bob')
      expect(search.role).toBe('Admin')
    })

    it('omits optional fields when undefined', () => {
      const def = makeDefinition()
      const search = def.stringify({ page: 1, perPage: 10 })
      expect(search).not.toHaveProperty('name')
      expect(search).not.toHaveProperty('gender')
      expect(search).not.toHaveProperty('role')
      expect(search).not.toHaveProperty('sort')
    })
  })

  // ── buildHref ──────────────────────────────────────────

  describe('buildHref', () => {
    it('returns base path when only defaults present', () => {
      const def = makeDefinition()
      const href = def.buildHref({ page: 1, perPage: DEFAULT_DATA_TABLE_PAGE_SIZE })
      expect(href).toMatch(/^\/dashboard\/users/)
    })

    it('includes non-default search params in href', () => {
      const def = makeDefinition()
      const href = def.buildHref({ page: 2, perPage: 50, name: 'Alice' })
      expect(href).toContain('page=2')
      expect(href).toContain('perPage=50')
      expect(href).toContain('name=Alice')
    })

    it('preserves sort param in href', () => {
      const sort = JSON.stringify([{ id: 'name', desc: true }])
      const def = makeDefinition()
      const href = def.buildHref({ page: 1, perPage: 10, sort })
      expect(href).toContain('sort=')
    })
  })

  // ── getPageChrome ──────────────────────────────────────

  describe('getPageChrome', () => {
    it('returns title and description', () => {
      const def = makeDefinition()
      const chrome = def.getPageChrome()
      expect(chrome.title).toBe('Users')
      expect(chrome.description).toBeDefined()
    })
  })

  // ── refresh ────────────────────────────────────────────

  describe('refresh', () => {
    it('invalidates userKeys.list with current filters after parse', () => {
      const qc = mockQueryClient()
      const def = makeDefinition(qc)

      def.parse({ page: 3, perPage: 50, name: 'Alice', role: 'Developer' }, {})
      def.refresh()

      expect(qc.invalidateQueries).toHaveBeenCalledTimes(1)
      const callArg = (qc.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArg.queryKey).toEqual(
        userKeys.list({ page: 3, limit: 50, search: 'Alice', roles: 'Developer' }),
      )
    })

    it('invalidates with correct filters when only page and perPage are set', () => {
      const qc = mockQueryClient()
      const def = makeDefinition(qc)

      def.parse({ page: 1, perPage: DEFAULT_DATA_TABLE_PAGE_SIZE }, {})
      def.refresh()

      expect(qc.invalidateQueries).toHaveBeenCalledTimes(1)
      const callArg = (qc.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArg.queryKey).toEqual(
        userKeys.list({ page: 1, limit: DEFAULT_DATA_TABLE_PAGE_SIZE }),
      )
    })

    it('does not throw when refresh is called before parse', () => {
      const qc = mockQueryClient()
      const def = makeDefinition(qc)

      expect(() => def.refresh()).not.toThrow()
      expect(qc.invalidateQueries).not.toHaveBeenCalled()
    })

    it('uses the most recent parse filters on refresh', () => {
      const qc = mockQueryClient()
      const def = makeDefinition(qc)

      def.parse({ page: 1, perPage: 10, name: 'First' }, {})
      def.parse({ page: 2, perPage: 10, name: 'Second' }, {})
      def.refresh()

      expect(qc.invalidateQueries).toHaveBeenCalledTimes(1)
      const callArg = (qc.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArg.queryKey).toEqual(
        userKeys.list({ page: 2, limit: 10, search: 'Second' }),
      )
    })
  })
})
