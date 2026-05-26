import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseProductListSearch,
  stringifyProductListState,
  buildProductListHref,
  stateToProductFilters,
  productWorkspaceDefinition,
  setProductWorkspaceFilters,
  resetProductWorkspaceFilters,
} from './product-workspace-definition'
import type { ProductListState } from './product-workspace-definition'
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size'

const DEFAULT_STATE: ProductListState = {
  page: 1,
  perPage: DEFAULT_DATA_TABLE_PAGE_SIZE,
}

const VALID_CATEGORY = '美妆个护'

const { invalidateQueries } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}))

vi.mock('@/lib/query-client', () => ({
  getQueryClient: () => ({ invalidateQueries }),
}))

describe('parseProductListSearch', () => {
  it('parses empty search to default state', () => {
    expect(parseProductListSearch({})).toEqual(DEFAULT_STATE)
  })

  it('parses page and perPage', () => {
    expect(parseProductListSearch({ page: 3, perPage: 50 })).toEqual({
      page: 3,
      perPage: 50,
    })
  })

  it('parses name filter', () => {
    expect(parseProductListSearch({ name: '身体乳' })).toEqual({
      ...DEFAULT_STATE,
      name: '身体乳',
    })
  })

  it('trims whitespace from name', () => {
    expect(parseProductListSearch({ name: '  身体乳  ' })).toEqual({
      ...DEFAULT_STATE,
      name: '身体乳',
    })
  })

  it('ignores empty name string', () => {
    expect(parseProductListSearch({ name: '' })).toEqual(DEFAULT_STATE)
  })

  it('parses valid category', () => {
    expect(parseProductListSearch({ category: VALID_CATEGORY })).toEqual({
      ...DEFAULT_STATE,
      category: VALID_CATEGORY,
    })
  })

  it('ignores invalid category', () => {
    expect(parseProductListSearch({ category: 'invalid-category' })).toEqual(DEFAULT_STATE)
  })

  it('parses sort', () => {
    expect(parseProductListSearch({ sort: '[{"id":"name","desc":false}]' })).toEqual({
      ...DEFAULT_STATE,
      sort: '[{"id":"name","desc":false}]',
    })
  })

  it('falls back to page 1 when page is invalid', () => {
    expect(parseProductListSearch({ page: -1 })).toMatchObject({ page: 1 })
    expect(parseProductListSearch({ page: 'abc' })).toMatchObject({ page: 1 })
  })

  it('uses explicit URL perPage over localStorage default', () => {
    expect(parseProductListSearch({ perPage: 100 })).toMatchObject({ perPage: 100 })
  })

  it('falls back to default perPage when perPage is invalid', () => {
    expect(parseProductListSearch({ perPage: 999 })).toMatchObject({
      perPage: DEFAULT_DATA_TABLE_PAGE_SIZE,
    })
  })
})

describe('stringifyProductListState', () => {
  it('stringifies default state', () => {
    expect(stringifyProductListState(DEFAULT_STATE)).toEqual({
      page: 1,
      perPage: DEFAULT_DATA_TABLE_PAGE_SIZE,
    })
  })

  it('stringifies full state', () => {
    const state: ProductListState = {
      page: 2,
      perPage: 50,
      name: '身体乳',
      category: VALID_CATEGORY,
      sort: '[{"id":"name","desc":false}]',
    }
    expect(stringifyProductListState(state)).toEqual({
      page: 2,
      perPage: 50,
      name: '身体乳',
      category: VALID_CATEGORY,
      sort: '[{"id":"name","desc":false}]',
    })
  })

  it('omits undefined optional fields', () => {
    const result = stringifyProductListState(DEFAULT_STATE)
    expect(result).not.toHaveProperty('name')
    expect(result).not.toHaveProperty('category')
    expect(result).not.toHaveProperty('sort')
  })
})

describe('buildProductListHref', () => {
  it('builds href from default state', () => {
    const href = buildProductListHref(DEFAULT_STATE)
    expect(href).toContain('/dashboard/product?')
    expect(href).toContain('page=1')
    expect(href).toContain(`perPage=${DEFAULT_DATA_TABLE_PAGE_SIZE}`)
  })

  it('builds href with all filters', () => {
    const href = buildProductListHref({
      page: 3,
      perPage: 50,
      name: '身体乳',
      category: VALID_CATEGORY,
      sort: '[{"id":"name","desc":false}]',
    })
    expect(href).toContain('page=3')
    expect(href).toContain('perPage=50')
    expect(href).toContain('name=%E8%BA%AB%E4%BD%93%E4%B9%B3')
    expect(href).toContain('category=' + encodeURIComponent(VALID_CATEGORY))
  })

  it('round-trips: parse(stringify(state)) === state', () => {
    const original: ProductListState = {
      page: 2,
      perPage: 100,
      name: 'test',
      category: VALID_CATEGORY,
      sort: '[{"id":"name","desc":true}]',
    }
    const roundTripped = parseProductListSearch(stringifyProductListState(original))
    expect(roundTripped).toEqual(original)
  })
})

describe('stateToProductFilters', () => {
  it('maps state fields to API filters', () => {
    const state: ProductListState = {
      page: 2,
      perPage: 50,
      name: '身体乳',
      category: VALID_CATEGORY,
    }
    expect(stateToProductFilters(state)).toEqual({
      page: 2,
      limit: 50,
      search: '身体乳',
      categories: VALID_CATEGORY,
    })
  })

  it('omits undefined optional fields', () => {
    const filters = stateToProductFilters(DEFAULT_STATE)
    expect(filters).toEqual({
      page: 1,
      limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    })
    expect(filters).not.toHaveProperty('search')
    expect(filters).not.toHaveProperty('categories')
    expect(filters).not.toHaveProperty('sort')
  })

  it('includes sort when present', () => {
    const state: ProductListState = {
      ...DEFAULT_STATE,
      sort: '[{"id":"name","desc":false}]',
    }
    expect(stateToProductFilters(state)).toHaveProperty(
      'sort',
      '[{"id":"name","desc":false}]',
    )
  })
})

describe('productWorkspaceDefinition.refresh', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { href: 'http://localhost:3000' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    invalidateQueries.mockClear()
    resetProductWorkspaceFilters()
  })

  it('calls invalidateQueries with productKeys.list(filters) when filters are set', () => {
    const filters = { page: 2, limit: 50, search: '身体乳' }
    setProductWorkspaceFilters(filters)
    productWorkspaceDefinition.refresh()
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'list', filters],
    })
  })

  it('does not call invalidateQueries when no filters are set', () => {
    productWorkspaceDefinition.refresh()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})

describe('productWorkspaceDefinition.getPageChrome', () => {
  it('returns product page chrome', () => {
    const chrome = productWorkspaceDefinition.getPageChrome()
    expect(chrome.title).toBe('概览：产品管理')
  })
})
