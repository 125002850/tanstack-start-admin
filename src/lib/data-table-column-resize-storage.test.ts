import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadColumnSizing,
  saveColumnSizing,
  clearColumnSizing
} from './data-table-column-resize-storage';

const TABLE_ID = 'test-table';
const STORAGE_KEY = 'data-table:test-table:column-sizing';

function buildCache(sizing: Record<string, number>) {
  return JSON.stringify({ version: 1, sizing });
}

describe('data-table-column-resize-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('loadColumnSizing', () => {
    it('returns {} when no cache exists', () => {
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('returns {} when mode is false', () => {
      localStorage.setItem(STORAGE_KEY, buildCache({ name: 200 }));
      expect(loadColumnSizing(TABLE_ID, false)).toEqual({});
    });

    it('reads valid cache with version 1 and sizing', () => {
      localStorage.setItem(STORAGE_KEY, buildCache({ name: 200, email: 150 }));
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({
        name: 200,
        email: 150
      });
    });

    it('returns {} on version mismatch', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, sizing: { name: 200 } }));
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('returns {} on corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{broken');
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('returns {} when cache is not an object', () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"');
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('returns {} when cache is an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ version: 1 }]));
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({});
    });

    it('filters out non-finite sizing values', () => {
      localStorage.setItem(
        STORAGE_KEY,
        buildCache({ name: 200, email: Infinity, role: NaN } as Record<string, number>)
      );
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({ name: 200 });
    });

    it('filters out zero or negative sizing values', () => {
      localStorage.setItem(STORAGE_KEY, buildCache({ name: 0, email: -10, role: 100 }));
      expect(loadColumnSizing(TABLE_ID, 'localStorage')).toEqual({ role: 100 });
    });

    it('different tableIds are isolated', () => {
      localStorage.setItem('data-table:table-a:column-sizing', buildCache({ col: 100 }));
      localStorage.setItem('data-table:table-b:column-sizing', buildCache({ col: 200 }));
      expect(loadColumnSizing('table-a', 'localStorage')).toEqual({ col: 100 });
      expect(loadColumnSizing('table-b', 'localStorage')).toEqual({ col: 200 });
    });
  });

  describe('saveColumnSizing', () => {
    it('writes cache with correct key and structure', () => {
      saveColumnSizing(TABLE_ID, { name: 300 }, 'localStorage');
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toEqual({ version: 1, sizing: { name: 300 } });
    });

    it('does not write when mode is false', () => {
      localStorage.setItem(STORAGE_KEY, 'existing');
      saveColumnSizing(TABLE_ID, { name: 300 }, false);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('existing');
    });

    it('writes to sessionStorage when mode is sessionStorage', () => {
      saveColumnSizing(TABLE_ID, { col: 42 }, 'sessionStorage');
      const raw = sessionStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.sizing).toEqual({ col: 42 });
    });

    it('different tableIds write to different keys', () => {
      saveColumnSizing('table-a', { a: 1 }, 'localStorage');
      saveColumnSizing('table-b', { b: 2 }, 'localStorage');
      expect(JSON.parse(localStorage.getItem('data-table:table-a:column-sizing')!).sizing).toEqual({
        a: 1
      });
      expect(JSON.parse(localStorage.getItem('data-table:table-b:column-sizing')!).sizing).toEqual({
        b: 2
      });
    });
  });

  describe('clearColumnSizing', () => {
    it('removes cache for the given tableId', () => {
      localStorage.setItem(STORAGE_KEY, buildCache({ name: 200 }));
      clearColumnSizing(TABLE_ID, 'localStorage');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does nothing when mode is false', () => {
      localStorage.setItem(STORAGE_KEY, 'existing');
      clearColumnSizing(TABLE_ID, false);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('existing');
    });

    it('clears from sessionStorage when mode is sessionStorage', () => {
      sessionStorage.setItem(STORAGE_KEY, buildCache({ col: 1 }));
      clearColumnSizing(TABLE_ID, 'sessionStorage');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('only clears the targeted tableId', () => {
      localStorage.setItem('data-table:table-a:column-sizing', buildCache({ a: 1 }));
      localStorage.setItem('data-table:table-b:column-sizing', buildCache({ b: 2 }));
      clearColumnSizing('table-a', 'localStorage');
      expect(localStorage.getItem('data-table:table-a:column-sizing')).toBeNull();
      expect(localStorage.getItem('data-table:table-b:column-sizing')).not.toBeNull();
    });
  });

  describe('sessionStorage round-trip', () => {
    it('load returns what save wrote', () => {
      saveColumnSizing(TABLE_ID, { x: 111, y: 222 }, 'sessionStorage');
      expect(loadColumnSizing(TABLE_ID, 'sessionStorage')).toEqual({
        x: 111,
        y: 222
      });
    });
  });
});
