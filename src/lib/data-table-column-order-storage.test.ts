import { beforeEach, describe, expect, it } from 'vitest';

import {
  areColumnOrdersEqual,
  clearColumnOrder,
  loadColumnOrder,
  moveColumnOrder,
  saveColumnOrder
} from './data-table-column-order-storage';

const TABLE_ID = 'test-table';
const STORAGE_KEY = 'data-table:test-table:column-order';

function buildCache(order: unknown) {
  return JSON.stringify({ version: 1, order });
}

describe('data-table-column-order-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('loadColumnOrder', () => {
    it('returns [] when no cache exists', () => {
      expect(loadColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);
    });

    it('returns [] when mode is false', () => {
      localStorage.setItem(STORAGE_KEY, buildCache(['name']));

      expect(loadColumnOrder(TABLE_ID, false)).toEqual([]);
    });

    it('reads valid cache with version 1 and order', () => {
      localStorage.setItem(STORAGE_KEY, buildCache(['name', 'id']));

      expect(loadColumnOrder(TABLE_ID, 'localStorage')).toEqual(['name', 'id']);
    });

    it('filters invalid, blank, and duplicated column ids', () => {
      localStorage.setItem(STORAGE_KEY, buildCache(['name', '', ' name ', 1, 'id', 'id']));

      expect(loadColumnOrder(TABLE_ID, 'localStorage')).toEqual(['name', 'id']);
    });

    it('returns [] on corrupt or mismatched cache', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, order: ['name'] }));
      expect(loadColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);

      localStorage.setItem(STORAGE_KEY, '{broken');
      expect(loadColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(['name']));
      expect(loadColumnOrder(TABLE_ID, 'localStorage')).toEqual([]);
    });
  });

  describe('saveColumnOrder', () => {
    it('writes cache with correct key and structure', () => {
      saveColumnOrder(TABLE_ID, ['name', 'id'], 'localStorage');

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
        version: 1,
        order: ['name', 'id']
      });
    });

    it('writes to sessionStorage when requested', () => {
      saveColumnOrder(TABLE_ID, ['id'], 'sessionStorage');

      expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)).toEqual({
        version: 1,
        order: ['id']
      });
    });

    it('does not write when mode is false', () => {
      localStorage.setItem(STORAGE_KEY, 'existing');
      saveColumnOrder(TABLE_ID, ['name'], false);

      expect(localStorage.getItem(STORAGE_KEY)).toBe('existing');
    });
  });

  describe('clearColumnOrder', () => {
    it('removes cache for the given tableId', () => {
      localStorage.setItem(STORAGE_KEY, buildCache(['name']));

      clearColumnOrder(TABLE_ID, 'localStorage');

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('moveColumnOrder', () => {
    it('moves one column before the target column', () => {
      expect(moveColumnOrder(['id', 'name', 'email'], 'email', 'name')).toEqual([
        'id',
        'email',
        'name'
      ]);
    });

    it('returns the original order when either column is missing', () => {
      const order = ['id', 'name'];

      expect(moveColumnOrder(order, 'missing', 'name')).toBe(order);
      expect(moveColumnOrder(order, 'id', 'missing')).toBe(order);
    });
  });

  describe('areColumnOrdersEqual', () => {
    it('compares undefined as an empty order', () => {
      expect(areColumnOrdersEqual(undefined, [])).toBe(true);
      expect(areColumnOrdersEqual(['name'], undefined)).toBe(false);
      expect(areColumnOrdersEqual(['id', 'name'], ['id', 'name'])).toBe(true);
    });
  });
});
