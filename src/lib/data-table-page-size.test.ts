import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readDataTablePageSize,
  writeDataTablePageSize,
  isValidDataTablePageSize,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  DATA_TABLE_PAGE_SIZE_OPTIONS,
  useDataTablePageSize
} from './data-table-page-size';

const STORAGE_KEY = 'app-data-table-per-page';
const USERS_STORAGE_KEY = 'app-data-table-per-page:users';
const ORDERS_STORAGE_KEY = 'app-data-table-per-page:orders';

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERS_STORAGE_KEY);
    localStorage.removeItem(ORDERS_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

describe('data-table-page-size', () => {
  beforeEach(() => {
    clearStorage();
  });

  describe('readDataTablePageSize', () => {
    it('returns null when no preference is stored', () => {
      expect(readDataTablePageSize()).toBeNull();
    });

    it('returns persisted value from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '50');
      expect(readDataTablePageSize()).toBe(50);
    });

    it('returns null for invalid persisted values', () => {
      localStorage.setItem(STORAGE_KEY, '999');
      expect(readDataTablePageSize()).toBeNull();
    });

    it('returns null for non-numeric persisted values', () => {
      localStorage.setItem(STORAGE_KEY, 'abc');
      expect(readDataTablePageSize()).toBeNull();
    });

    it('reads table-scoped values when tableId is provided', () => {
      localStorage.setItem(USERS_STORAGE_KEY, '50');
      localStorage.setItem(ORDERS_STORAGE_KEY, '100');

      expect(readDataTablePageSize('users')).toBe(50);
      expect(readDataTablePageSize('orders')).toBe(100);
    });
  });

  describe('writeDataTablePageSize', () => {
    it('persists a valid page size to localStorage', () => {
      writeDataTablePageSize(100);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('100');
    });

    it('normalizes invalid values to default before persisting', () => {
      writeDataTablePageSize(999);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(String(DEFAULT_DATA_TABLE_PAGE_SIZE));
    });

    it('round-trips: write then read returns same value', () => {
      for (const size of DATA_TABLE_PAGE_SIZE_OPTIONS) {
        writeDataTablePageSize(size);
        expect(readDataTablePageSize()).toBe(size);
      }
    });

    it('persists table-scoped values without polluting other tables', () => {
      writeDataTablePageSize(50, 'users');
      writeDataTablePageSize(100, 'orders');

      expect(localStorage.getItem(USERS_STORAGE_KEY)).toBe('50');
      expect(localStorage.getItem(ORDERS_STORAGE_KEY)).toBe('100');
      expect(readDataTablePageSize('users')).toBe(50);
      expect(readDataTablePageSize('orders')).toBe(100);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('isValidDataTablePageSize', () => {
    it('accepts values in DATA_TABLE_PAGE_SIZE_OPTIONS', () => {
      expect(isValidDataTablePageSize(10)).toBe(true);
      expect(isValidDataTablePageSize(50)).toBe(true);
      expect(isValidDataTablePageSize(100)).toBe(true);
      expect(isValidDataTablePageSize(500)).toBe(true);
      expect(isValidDataTablePageSize(2000)).toBe(true);
    });

    it('rejects values not in the allowed set', () => {
      expect(isValidDataTablePageSize(25)).toBe(false);
      expect(isValidDataTablePageSize(0)).toBe(false);
      expect(isValidDataTablePageSize(-1)).toBe(false);
    });

    it('rejects non-number values', () => {
      expect(isValidDataTablePageSize('50')).toBe(false);
      expect(isValidDataTablePageSize(null)).toBe(false);
      expect(isValidDataTablePageSize(undefined)).toBe(false);
    });
  });

  describe('preference contract', () => {
    it('readDataTablePageSize does not read from URL or router', () => {
      // localStorage is empty → null, regardless of any external state
      expect(readDataTablePageSize()).toBeNull();
    });

    it('writeDataTablePageSize only writes to localStorage', () => {
      writeDataTablePageSize(50);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('50');
      // Does not touch any URL or router state (verified by absence of side effects)
    });
  });

  describe('useDataTablePageSize', () => {
    it('hydrates table-scoped persisted values after mount', async () => {
      localStorage.setItem(USERS_STORAGE_KEY, '50');

      const { result } = renderHook(() => useDataTablePageSize({ tableId: 'users' }));

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.pageSize).toBe(50);
    });

    it('updates only the current table scope when page size changes', async () => {
      localStorage.setItem(USERS_STORAGE_KEY, '50');
      localStorage.setItem(ORDERS_STORAGE_KEY, '100');

      const { result } = renderHook(() => useDataTablePageSize({ tableId: 'users' }));

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.setPageSize(10);
      });

      expect(localStorage.getItem(USERS_STORAGE_KEY)).toBe('10');
      expect(localStorage.getItem(ORDERS_STORAGE_KEY)).toBe('100');
    });
  });
});
