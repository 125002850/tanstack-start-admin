import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDataTablePageSize } from './use-data-table-page-size';

const USERS_STORAGE_KEY = 'app-data-table-per-page:users';
const ORDERS_STORAGE_KEY = 'app-data-table-per-page:orders';

describe('useDataTablePageSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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
    localStorage.setItem(ORDERS_STORAGE_KEY, '200');

    const { result } = renderHook(() => useDataTablePageSize({ tableId: 'users' }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.setPageSize(10);
    });

    expect(localStorage.getItem(USERS_STORAGE_KEY)).toBe('10');
    expect(localStorage.getItem(ORDERS_STORAGE_KEY)).toBe('200');
  });
});
