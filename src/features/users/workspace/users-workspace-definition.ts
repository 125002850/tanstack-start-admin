/**
 * @deprecated Superseded by V2 feature-local state (Task V2-02B).
 * Kept as inventory only. Not used by the v2 users main path.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { WorkspaceRouteDefinition } from '@/features/workspace-tabs/types'
import { buildSearchHref } from '@/features/workspace-tabs/lib/workspace-route-state'
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size'
import { userKeys } from '../api/queries'
import type { UserFilters } from '../api/types'

export type UsersWorkspaceState = {
  page: number
  perPage: number
  name?: string
  gender?: string
  role?: string
  sort?: string
}

function stateToFilters(state: UsersWorkspaceState): UserFilters {
  const filters: UserFilters = {
    page: state.page,
    limit: state.perPage,
  }
  if (state.name) filters.search = state.name
  if (state.role) filters.roles = state.role
  if (state.sort) filters.sort = state.sort
  return filters
}

function stateToSearch(state: UsersWorkspaceState): Record<string, unknown> {
  const result: Record<string, unknown> = { page: state.page, perPage: state.perPage }
  if (state.name) result.name = state.name
  if (state.gender) result.gender = state.gender
  if (state.role) result.role = state.role
  if (state.sort) result.sort = state.sort
  return result
}

export function createUsersWorkspaceDefinition(
  queryClient: QueryClient,
): WorkspaceRouteDefinition<UsersWorkspaceState> {
  let currentFilters: UserFilters | null = null

  return {
    parse(search, _params) {
      const page = (search.page as number) ?? 1
      const perPage = (search.perPage as number) ?? DEFAULT_DATA_TABLE_PAGE_SIZE
      const state: UsersWorkspaceState = { page, perPage }

      if (typeof search.name === 'string' && search.name.length > 0) state.name = search.name
      if (typeof search.gender === 'string' && search.gender.length > 0) state.gender = search.gender
      if (typeof search.role === 'string' && search.role.length > 0) state.role = search.role
      if (typeof search.sort === 'string' && search.sort.length > 0) state.sort = search.sort

      currentFilters = stateToFilters(state)
      return state
    },

    stringify(state) {
      return stateToSearch(state)
    },

    buildHref(state) {
      return buildSearchHref('/dashboard/users', stateToSearch(state))
    },

    getPageChrome() {
      return {
        title: 'Users',
        description: 'Manage users (React Query + search params table pattern.)',
      }
    },

    refresh() {
      if (currentFilters) {
        queryClient.invalidateQueries({ queryKey: userKeys.list(currentFilters) })
      }
    },
  }
}
