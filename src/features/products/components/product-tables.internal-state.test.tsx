import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SortingState } from '@tanstack/react-table';
import { resolveProductTableVirtualizationOptions } from './product-tables/virtualization';

import { makeApiFilters } from '@/hooks/use-data-table';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ProductTable — internal state', () => {
  describe('resolveProductTableVirtualizationOptions', () => {
    afterEach(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w.__DATA_TABLE_VIRTUAL_EVENTS__;
    });

    it('emits disabled-by-config and calls fallback callback when gate is off but browser is supported', () => {
      const fallback = vi.fn();
      const originalResizeObserver = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      } as typeof ResizeObserver;

      try {
        const options = resolveProductTableVirtualizationOptions(false, fallback);
        const events = (
          window as unknown as { __DATA_TABLE_VIRTUAL_EVENTS__?: Array<Record<string, unknown>> }
        ).__DATA_TABLE_VIRTUAL_EVENTS__;

        expect(options.enabled).toBe(false);
        expect(fallback).toHaveBeenCalledWith('disabled-by-config');
        expect(events?.some((evt) => evt.event === 'disabled-by-config')).toBe(true);
      } finally {
        globalThis.ResizeObserver = originalResizeObserver;
      }
    });

    it('emits unsupported-browser and calls fallback callback when ResizeObserver is unavailable', () => {
      const fallback = vi.fn();
      const originalResizeObserver = globalThis.ResizeObserver;
      // @ts-expect-error test intentionally simulates an unsupported browser
      delete globalThis.ResizeObserver;

      try {
        const options = resolveProductTableVirtualizationOptions(false, fallback);
        const events = (
          window as unknown as { __DATA_TABLE_VIRTUAL_EVENTS__?: Array<Record<string, unknown>> }
        ).__DATA_TABLE_VIRTUAL_EVENTS__;

        expect(options.enabled).toBe(false);
        expect(fallback).toHaveBeenCalledWith('unsupported-browser');
        expect(events?.some((evt) => evt.event === 'unsupported-browser')).toBe(true);
      } finally {
        globalThis.ResizeObserver = originalResizeObserver;
      }
    });
  });

  describe('makeApiFilters', () => {
    const builder = makeApiFilters({ name: 'search', category: 'categories' });

    it('defaults to page 1 with the given page size', () => {
      const filters = builder({ pageIndex: 0, pageSize: 10 }, [], []);
      expect(filters).toMatchObject({ page: 1, limit: 10 });
    });

    it('maps pageIndex to page + 1', () => {
      const filters = builder({ pageIndex: 4, pageSize: 25 }, [], []);
      expect(filters.page).toBe(5);
      expect(filters.limit).toBe(25);
    });

    it('maps name column filter to search param', () => {
      const filters = builder(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'name', value: 'test' }]
      );
      expect(filters).toMatchObject({ page: 1, limit: 10, search: 'test' });
    });

    it('omits search when name filter value is empty string', () => {
      const filters = builder(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'name', value: '' }]
      );
      expect(filters).not.toHaveProperty('search');
    });

    it('maps category multiSelect to comma-joined categories', () => {
      const filters = builder(
        { pageIndex: 1, pageSize: 25 },
        [],
        [{ id: 'category', value: ['电子产品', '服装'] }]
      );
      expect(filters).toMatchObject({ page: 2, limit: 25, categories: '电子产品,服装' });
    });

    it('omits categories when category filter value is empty array', () => {
      const filters = builder(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'category', value: [] }]
      );
      expect(filters).not.toHaveProperty('categories');
    });

    it('includes serialized sort when sorting is non-empty', () => {
      const sort: SortingState = [{ id: 'name', desc: true }];
      const filters = builder({ pageIndex: 0, pageSize: 10 }, sort, []);
      expect(filters.sort).toBe(JSON.stringify(sort));
    });

    it('omits sort key when sorting is empty', () => {
      const filters = builder({ pageIndex: 0, pageSize: 10 }, [], []);
      expect(filters).not.toHaveProperty('sort');
    });

    it('resets page to 1 when filters change (caller responsibility — verified via filter presence)', () => {
      // When filters are applied, the caller should reset page to 1.
      // This test verifies that buildApiFilters faithfully renders whatever pagination it receives.
      const withFilters = builder(
        { pageIndex: 0, pageSize: 10 },
        [],
        [{ id: 'name', value: 'filtered' }]
      );
      expect(withFilters.page).toBe(1);
      expect(withFilters.search).toBe('filtered');
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
      localStorage.setItem('app-data-table-per-page', '50');
      const { useDataTablePageSize } = await import('@/lib/data-table-page-size');
      const { result } = renderHook(() => useDataTablePageSize({}));
      expect(result.current.pageSize).toBe(50);
    });

    it('setPageSize writes to localStorage and updates state', async () => {
      const { useDataTablePageSize } = await import('@/lib/data-table-page-size');
      const { result } = renderHook(() => useDataTablePageSize({}));
      expect(result.current.pageSize).toBe(10);

      act(() => {
        result.current.setPageSize(100);
      });

      expect(result.current.pageSize).toBe(100);
      expect(localStorage.getItem('app-data-table-per-page')).toBe('100');
    });

    it('normalizes invalid page size values to default', async () => {
      localStorage.setItem('app-data-table-per-page', '999');
      const { useDataTablePageSize } = await import('@/lib/data-table-page-size');
      const { result } = renderHook(() => useDataTablePageSize({}));
      expect(result.current.pageSize).toBe(10);
    });
  });
});
