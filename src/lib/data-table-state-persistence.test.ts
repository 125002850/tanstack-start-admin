import { beforeEach, describe, expect, it } from 'vitest';

import {
  areDataTableSortingStatesEqual,
  areDataTableColumnOrdersEqual,
  clearDataTableColumnOrder,
  clearDataTableColumnSizing,
  clearDataTableSorting,
  DATA_TABLE_PAGE_SIZE_OPTIONS,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  isValidDataTablePageSize,
  loadDataTableColumnOrder,
  loadDataTableColumnSizing,
  loadDataTableSorting,
  moveDataTableColumnOrder,
  readDataTablePageSize,
  readDataTableSorting,
  saveDataTableColumnOrder,
  saveDataTableColumnSizing,
  saveDataTableSorting,
  writeDataTablePageSize
} from './data-table-state-persistence';

const TABLE_ID = 'test-table';
const COLUMN_SIZING_STORAGE_KEY = 'data-table:test-table:column-sizing';
const COLUMN_ORDER_STORAGE_KEY = 'data-table:test-table:column-order';
const SORTING_STORAGE_KEY = 'data-table:test-table:sorting';
const PAGE_SIZE_GLOBAL_STORAGE_KEY = 'app-data-table-per-page';
const PAGE_SIZE_STORAGE_KEY = 'app-data-table-per-page:test-table';
const USERS_PAGE_SIZE_STORAGE_KEY = 'app-data-table-per-page:users';
const ORDERS_PAGE_SIZE_STORAGE_KEY = 'app-data-table-per-page:orders';

function buildColumnSizingCache(sizing: unknown) {
  return JSON.stringify({ version: 1, sizing });
}

function buildColumnOrderCache(order: unknown) {
  return JSON.stringify({ version: 1, order });
}

function buildSortingCache(sorting: unknown) {
  return JSON.stringify({ version: 1, sorting });
}

describe('data-table-state-persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('column sizing persistence', () => {
    it('returns {} when no cache exists', () => {
      expect(loadDataTableColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('returns {} when mode is false', () => {
      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, buildColumnSizingCache({ name: 200 }));

      expect(loadDataTableColumnSizing(TABLE_ID, false)).toEqual({});
    });

    it('reads valid cache with version 1 and sizing', () => {
      localStorage.setItem(
        COLUMN_SIZING_STORAGE_KEY,
        buildColumnSizingCache({ name: 200, email: 150 })
      );

      expect(loadDataTableColumnSizing(TABLE_ID, 'localStorage')).toEqual({
        name: 200,
        email: 150
      });
    });

    it('returns {} on corrupt or mismatched sizing cache', () => {
      localStorage.setItem(
        COLUMN_SIZING_STORAGE_KEY,
        JSON.stringify({ version: 2, sizing: { name: 200 } })
      );
      expect(loadDataTableColumnSizing(TABLE_ID, 'localStorage')).toEqual({});

      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, '{broken');
      expect(loadDataTableColumnSizing(TABLE_ID, 'localStorage')).toEqual({});

      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(['name']));
      expect(loadDataTableColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('filters invalid sizing values', () => {
      localStorage.setItem(
        COLUMN_SIZING_STORAGE_KEY,
        buildColumnSizingCache({ name: 200, email: Infinity, role: NaN, zero: 0, negative: -10 })
      );

      expect(loadDataTableColumnSizing(TABLE_ID, 'localStorage')).toEqual({ name: 200 });
    });

    it('writes sizing cache with the shared data-table key format', () => {
      saveDataTableColumnSizing(TABLE_ID, { name: 300 }, 'localStorage');

      expect(JSON.parse(localStorage.getItem(COLUMN_SIZING_STORAGE_KEY)!)).toEqual({
        version: 1,
        sizing: { name: 300 }
      });
    });

    it('uses sessionStorage when requested for sizing', () => {
      saveDataTableColumnSizing(TABLE_ID, { col: 42 }, 'sessionStorage');

      expect(localStorage.getItem(COLUMN_SIZING_STORAGE_KEY)).toBeNull();
      expect(JSON.parse(sessionStorage.getItem(COLUMN_SIZING_STORAGE_KEY)!)).toEqual({
        version: 1,
        sizing: { col: 42 }
      });
    });

    it('does not write or clear sizing when mode is false', () => {
      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, 'existing');

      saveDataTableColumnSizing(TABLE_ID, { name: 300 }, false);
      clearDataTableColumnSizing(TABLE_ID, false);

      expect(localStorage.getItem(COLUMN_SIZING_STORAGE_KEY)).toBe('existing');
    });

    it('clears sizing cache for the given tableId only', () => {
      localStorage.setItem('data-table:table-a:column-sizing', buildColumnSizingCache({ a: 1 }));
      localStorage.setItem('data-table:table-b:column-sizing', buildColumnSizingCache({ b: 2 }));

      clearDataTableColumnSizing('table-a', 'localStorage');

      expect(localStorage.getItem('data-table:table-a:column-sizing')).toBeNull();
      expect(localStorage.getItem('data-table:table-b:column-sizing')).not.toBeNull();
    });
  });

  describe('column order persistence', () => {
    it('returns [] when no cache exists', () => {
      expect(loadDataTableColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);
    });

    it('returns [] when mode is false', () => {
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, buildColumnOrderCache(['name']));

      expect(loadDataTableColumnOrder(TABLE_ID, false)).toEqual([]);
    });

    it('reads and sanitizes column order cache', () => {
      localStorage.setItem(
        COLUMN_ORDER_STORAGE_KEY,
        buildColumnOrderCache(['name', '', ' name ', 1, 'id', 'id'])
      );

      expect(loadDataTableColumnOrder(TABLE_ID, 'localStorage')).toEqual(['name', 'id']);
    });

    it('returns [] on corrupt or mismatched column order cache', () => {
      localStorage.setItem(
        COLUMN_ORDER_STORAGE_KEY,
        JSON.stringify({ version: 2, order: ['name'] })
      );
      expect(loadDataTableColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);

      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, '{broken');
      expect(loadDataTableColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);

      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(['name']));
      expect(loadDataTableColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);
    });

    it('writes column order cache with the shared data-table key format', () => {
      saveDataTableColumnOrder(TABLE_ID, ['name', 'id'], 'localStorage');

      expect(JSON.parse(localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)!)).toEqual({
        version: 1,
        order: ['name', 'id']
      });
    });

    it('uses sessionStorage when requested for column order', () => {
      saveDataTableColumnOrder(TABLE_ID, ['id'], 'sessionStorage');

      expect(localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)).toBeNull();
      expect(JSON.parse(sessionStorage.getItem(COLUMN_ORDER_STORAGE_KEY)!)).toEqual({
        version: 1,
        order: ['id']
      });
    });

    it('does not write or clear column order when mode is false', () => {
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, 'existing');

      saveDataTableColumnOrder(TABLE_ID, ['name'], false);
      clearDataTableColumnOrder(TABLE_ID, false);

      expect(localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)).toBe('existing');
    });

    it('clears column order cache for the given tableId', () => {
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, buildColumnOrderCache(['name']));

      clearDataTableColumnOrder(TABLE_ID, 'localStorage');

      expect(localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)).toBeNull();
    });

    it('moves one column before the target column', () => {
      expect(moveDataTableColumnOrder(['id', 'name', 'email'], 'email', 'name')).toEqual([
        'id',
        'email',
        'name'
      ]);
    });

    it('returns the original order when either moved column is missing', () => {
      const order = ['id', 'name'];

      expect(moveDataTableColumnOrder(order, 'missing', 'name')).toBe(order);
      expect(moveDataTableColumnOrder(order, 'id', 'missing')).toBe(order);
    });

    it('compares undefined as an empty column order', () => {
      expect(areDataTableColumnOrdersEqual(undefined, [])).toBe(true);
      expect(areDataTableColumnOrdersEqual(['name'], undefined)).toBe(false);
      expect(areDataTableColumnOrdersEqual(['id', 'name'], ['id', 'name'])).toBe(true);
    });
  });

  describe('sorting persistence', () => {
    it('returns null when no sorting cache exists', () => {
      expect(readDataTableSorting(TABLE_ID, 'localStorage')).toBeNull();
      expect(loadDataTableSorting(TABLE_ID, 'localStorage')).toEqual([]);
    });

    it('reads and sanitizes sorting cache', () => {
      localStorage.setItem(
        SORTING_STORAGE_KEY,
        buildSortingCache([
          { id: ' name ', desc: true },
          { id: '', desc: false },
          { id: 'id', desc: false },
          { id: 'name', desc: false },
          { id: 'email', desc: 'yes' },
          null
        ])
      );

      expect(readDataTableSorting(TABLE_ID, 'localStorage')).toEqual([
        { id: 'name', desc: true },
        { id: 'id', desc: false }
      ]);
    });

    it('returns null on corrupt or mismatched sorting cache', () => {
      localStorage.setItem(
        SORTING_STORAGE_KEY,
        JSON.stringify({ version: 2, sorting: [{ id: 'name', desc: true }] })
      );
      expect(readDataTableSorting(TABLE_ID, 'localStorage')).toBeNull();

      localStorage.setItem(SORTING_STORAGE_KEY, '{broken');
      expect(readDataTableSorting(TABLE_ID, 'localStorage')).toBeNull();

      localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(['name']));
      expect(readDataTableSorting(TABLE_ID, 'localStorage')).toBeNull();
    });

    it('writes sorting cache with the shared data-table key format', () => {
      saveDataTableSorting(
        TABLE_ID,
        [
          { id: 'name', desc: true },
          { id: 'id', desc: false }
        ],
        'localStorage'
      );

      expect(JSON.parse(localStorage.getItem(SORTING_STORAGE_KEY)!)).toEqual({
        version: 1,
        sorting: [
          { id: 'name', desc: true },
          { id: 'id', desc: false }
        ]
      });
    });

    it('uses sessionStorage when requested', () => {
      saveDataTableSorting(TABLE_ID, [{ id: 'name', desc: true }], 'sessionStorage');

      expect(localStorage.getItem(SORTING_STORAGE_KEY)).toBeNull();
      expect(JSON.parse(sessionStorage.getItem(SORTING_STORAGE_KEY)!)).toEqual({
        version: 1,
        sorting: [{ id: 'name', desc: true }]
      });
    });

    it('does not read, write, or clear when mode is false', () => {
      localStorage.setItem(SORTING_STORAGE_KEY, buildSortingCache([{ id: 'name', desc: true }]));

      expect(readDataTableSorting(TABLE_ID, false)).toBeNull();
      saveDataTableSorting(TABLE_ID, [{ id: 'id', desc: false }], false);
      clearDataTableSorting(TABLE_ID, false);

      expect(JSON.parse(localStorage.getItem(SORTING_STORAGE_KEY)!)).toEqual({
        version: 1,
        sorting: [{ id: 'name', desc: true }]
      });
    });

    it('clears sorting cache for the given tableId', () => {
      localStorage.setItem(SORTING_STORAGE_KEY, buildSortingCache([{ id: 'name', desc: true }]));

      clearDataTableSorting(TABLE_ID, 'localStorage');

      expect(localStorage.getItem(SORTING_STORAGE_KEY)).toBeNull();
    });

    it('compares sorting states by id and direction', () => {
      expect(areDataTableSortingStatesEqual(undefined, [])).toBe(true);
      expect(
        areDataTableSortingStatesEqual([{ id: 'name', desc: true }], [{ id: 'name', desc: true }])
      ).toBe(true);
      expect(
        areDataTableSortingStatesEqual([{ id: 'name', desc: true }], [{ id: 'name', desc: false }])
      ).toBe(false);
    });
  });

  describe('page size persistence', () => {
    it('returns null when no page size preference is stored', () => {
      expect(readDataTablePageSize()).toBeNull();
    });

    it('returns persisted page size from localStorage', () => {
      localStorage.setItem(PAGE_SIZE_GLOBAL_STORAGE_KEY, '50');

      expect(readDataTablePageSize()).toBe(50);
    });

    it('returns null for invalid page size values', () => {
      localStorage.setItem(PAGE_SIZE_GLOBAL_STORAGE_KEY, '999');
      expect(readDataTablePageSize()).toBeNull();

      localStorage.setItem(PAGE_SIZE_GLOBAL_STORAGE_KEY, 'abc');
      expect(readDataTablePageSize()).toBeNull();
    });

    it('reads table-scoped page size values when tableId is provided', () => {
      localStorage.setItem(USERS_PAGE_SIZE_STORAGE_KEY, '50');
      localStorage.setItem(ORDERS_PAGE_SIZE_STORAGE_KEY, '200');

      expect(readDataTablePageSize('users')).toBe(50);
      expect(readDataTablePageSize('orders')).toBe(200);
    });

    it('persists a valid page size to localStorage', () => {
      writeDataTablePageSize(200, TABLE_ID);

      expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('200');
      expect(readDataTablePageSize(TABLE_ID)).toBe(200);
    });

    it('normalizes invalid page size values to the default before persisting', () => {
      writeDataTablePageSize(999);

      expect(localStorage.getItem(PAGE_SIZE_GLOBAL_STORAGE_KEY)).toBe(
        String(DEFAULT_DATA_TABLE_PAGE_SIZE)
      );
    });

    it('round-trips all supported page size options', () => {
      for (const size of DATA_TABLE_PAGE_SIZE_OPTIONS) {
        writeDataTablePageSize(size);
        expect(readDataTablePageSize()).toBe(size);
      }
    });

    it('persists table-scoped page sizes without polluting other tables', () => {
      writeDataTablePageSize(50, 'users');
      writeDataTablePageSize(200, 'orders');

      expect(localStorage.getItem(USERS_PAGE_SIZE_STORAGE_KEY)).toBe('50');
      expect(localStorage.getItem(ORDERS_PAGE_SIZE_STORAGE_KEY)).toBe('200');
      expect(readDataTablePageSize('users')).toBe(50);
      expect(readDataTablePageSize('orders')).toBe(200);
      expect(localStorage.getItem(PAGE_SIZE_GLOBAL_STORAGE_KEY)).toBeNull();
    });

    it('validates page size options', () => {
      expect(isValidDataTablePageSize(10)).toBe(true);
      expect(isValidDataTablePageSize(50)).toBe(true);
      expect(isValidDataTablePageSize(200)).toBe(true);
      expect(isValidDataTablePageSize(500)).toBe(true);
      expect(isValidDataTablePageSize(2000)).toBe(true);
      expect(isValidDataTablePageSize(25)).toBe(false);
      expect(isValidDataTablePageSize(0)).toBe(false);
      expect(isValidDataTablePageSize('50')).toBe(false);
      expect(isValidDataTablePageSize(null)).toBe(false);
    });
  });
});
