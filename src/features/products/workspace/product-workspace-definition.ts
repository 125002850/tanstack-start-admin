/**
 * @deprecated Superseded by V2 feature-local state (Task V2-02B).
 * Kept as inventory only. Not used by the v2 products main path.
 */
import type { WorkspaceRouteDefinition } from '@/features/workspace-tabs/types'
import type { ProductFilters } from '../api/types'
import { productKeys } from '../api/queries'
import { getQueryClient } from '@/lib/query-client'
import {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  isValidDataTablePageSize,
  readDataTablePageSize,
} from '@/lib/data-table-page-size'
import { PRODUCT_CATEGORIES } from '@/constants/product-categories'

export interface ProductListState {
  page: number
  perPage: number
  name?: string
  category?: string
  sort?: string
}

const PRODUCT_LIST_PATH = '/dashboard/product'

function isValidCategory(value: unknown): value is string {
  return typeof value === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(value)
}

function normalizePerPage(rawSearch: Record<string, unknown>): number {
  const hasExplicitPerPage = Object.prototype.hasOwnProperty.call(rawSearch, 'perPage')
  if (hasExplicitPerPage && isValidDataTablePageSize(rawSearch.perPage)) {
    return rawSearch.perPage as number
  }
  const stored = readDataTablePageSize()
  return stored ?? DEFAULT_DATA_TABLE_PAGE_SIZE
}

export function parseProductListSearch(
  search: Record<string, unknown>,
  _params?: Record<string, string>,
): ProductListState {
  return {
    page: typeof search.page === 'number' && search.page > 0 ? search.page : 1,
    perPage: normalizePerPage(search),
    name: typeof search.name === 'string' && search.name.trim().length > 0 ? search.name.trim() : undefined,
    category: isValidCategory(search.category) ? search.category : undefined,
    sort: typeof search.sort === 'string' && search.sort.trim().length > 0 ? search.sort.trim() : undefined,
  }
}

export function stringifyProductListState(state: ProductListState): Record<string, unknown> {
  const result: Record<string, unknown> = {
    page: state.page,
    perPage: state.perPage,
  }
  if (state.name) result.name = state.name
  if (state.category) result.category = state.category
  if (state.sort) result.sort = state.sort
  return result
}

export function buildProductListHref(state: ProductListState): string {
  const params = new URLSearchParams()
  params.set('page', String(state.page))
  params.set('perPage', String(state.perPage))
  if (state.name) params.set('name', state.name)
  if (state.category) params.set('category', state.category)
  if (state.sort) params.set('sort', state.sort)
  const qs = params.toString()
  return qs ? `${PRODUCT_LIST_PATH}?${qs}` : PRODUCT_LIST_PATH
}

export function stateToProductFilters(state: ProductListState): ProductFilters {
  return {
    page: state.page,
    limit: state.perPage,
    ...(state.name && { search: state.name }),
    ...(state.category && { categories: state.category }),
    ...(state.sort && { sort: state.sort }),
  }
}

let currentFilters: ProductFilters | null = null

export function setProductWorkspaceFilters(filters: ProductFilters): void {
  currentFilters = filters
}

export function resetProductWorkspaceFilters(): void {
  currentFilters = null
}

export const productWorkspaceDefinition: WorkspaceRouteDefinition<ProductListState> = {
  parse: parseProductListSearch,
  stringify: stringifyProductListState,
  buildHref: buildProductListHref,
  getPageChrome: () => ({
    title: '概览：产品管理',
    description: '管理你的产品目录',
  }),
  refresh: () => {
    const filters = currentFilters
    if (filters) {
      getQueryClient().invalidateQueries({ queryKey: productKeys.list(filters) })
    }
  },
}
