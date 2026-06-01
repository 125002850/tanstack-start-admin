import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SortingState, ColumnFiltersState, PaginationState } from '@tanstack/react-table';

// ── Pure function: mirrors the filter derivation in users-table/index.tsx ────

function buildApiFilters(p: PaginationState, s: SortingState, f: ColumnFiltersState) {
  const nameFilter = f.find((flt) => flt.id === 'name');
  const roleFilter = f.find((flt) => flt.id === 'role');
  return {
    page: p.pageIndex + 1,
    limit: p.pageSize,
    ...(nameFilter?.value ? { search: String(nameFilter.value) } : {}),
    ...(roleFilter && Array.isArray(roleFilter.value) && roleFilter.value.length > 0
      ? { roles: roleFilter.value.join(',') }
      : {}),
    ...(s.length > 0 ? { sort: JSON.stringify(s) } : {})
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UsersTable — internal state', () => {
  describe('buildApiFilters', () => {
    it('defaults to page 1 with the given page size', () => {
      const filters = buildApiFilters({ pageIndex: 0, pageSize: 10 }, [], []);
      expect(filters).toMatchObject({ page: 1, limit: 10 });
    });

    it('maps pageIndex to page + 1', () => {
      const filters = buildApiFilters({ pageIndex: 3, pageSize: 50 }, [], []);
      expect(filters.page).toBe(4);
      expect(filters.limit).toBe(50);
    });

    it('maps name column filter to search param', () => {
      const filters = buildApiFilters(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'name', value: 'testuser' }]
      );
      expect(filters).toMatchObject({ page: 1, limit: 10, search: 'testuser' });
    });

    it('omits search when name filter value is empty string', () => {
      const filters = buildApiFilters(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'name', value: '' }]
      );
      expect(filters).not.toHaveProperty('search');
    });

    it('maps role multiSelect to comma-joined roles', () => {
      const filters = buildApiFilters(
        { pageIndex: 0, pageSize: 25 },
        [],
        [{ id: 'role', value: ['Developer', 'Manager'] }]
      );
      expect(filters).toMatchObject({ page: 1, limit: 25, roles: 'Developer,Manager' });
    });

    it('omits roles when role filter value is empty array', () => {
      const filters = buildApiFilters(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'role', value: [] }]
      );
      expect(filters).not.toHaveProperty('roles');
    });

    it('includes serialized sort when sorting is non-empty', () => {
      const sort: SortingState = [{ id: 'name', desc: false }];
      const filters = buildApiFilters({ pageIndex: 1, pageSize: 10 }, sort, []);
      expect(filters.sort).toBe(JSON.stringify(sort));
    });

    it('omits sort key when sorting is empty', () => {
      const filters = buildApiFilters({ pageIndex: 0, pageSize: 10 }, [], []);
      expect(filters).not.toHaveProperty('sort');
    });

    it('handles multiple filters simultaneously', () => {
      const sort: SortingState = [{ id: 'name', desc: true }];
      const filters = buildApiFilters({ pageIndex: 2, pageSize: 100 }, sort, [
        { id: 'name', value: 'john' },
        { id: 'role', value: ['QA', 'DevOps'] }
      ]);
      expect(filters).toMatchObject({
        page: 3,
        limit: 100,
        search: 'john',
        roles: 'QA,DevOps',
        sort: JSON.stringify(sort)
      });
    });
  });

  describe('useDataTablePageSize preference seed', () => {
    afterEach(() => {
      localStorage.clear();
    });

    it('falls back to default page size 10 when localStorage is empty', async () => {
      const { useDataTablePageSize } = await import('@/lib/data-table-page-size');
      const { result } = renderHook(() => useDataTablePageSize({}));
      expect(result.current.pageSize).toBe(10);
    });

    it('seeds page size from localStorage preference', async () => {
      localStorage.setItem('app-data-table-per-page', '100');
      const { useDataTablePageSize } = await import('@/lib/data-table-page-size');
      const { result } = renderHook(() => useDataTablePageSize({}));
      expect(result.current.pageSize).toBe(100);
    });

    it('setPageSize writes to localStorage and updates state', async () => {
      const { useDataTablePageSize } = await import('@/lib/data-table-page-size');
      const { result } = renderHook(() => useDataTablePageSize({}));
      expect(result.current.pageSize).toBe(10);

      act(() => {
        result.current.setPageSize(2000);
      });

      expect(result.current.pageSize).toBe(2000);
      expect(localStorage.getItem('app-data-table-per-page')).toBe('2000');
    });
  });
});
