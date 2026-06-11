import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/clients/dict', () => ({
  listGlobalTypesQueryOptions: vi.fn(() => ({
    queryKey: ['dictionary-types', 'list'],
    queryFn: vi.fn().mockResolvedValue({
      total: 1,
      list: [
        {
          id: 101,
          dictTypeCode: 'payment',
          dictTypeName: '付款状态',
          status: 'ENABLE',
          createBy: 1,
          createTime: '2026-06-09 09:00:00',
          updateBy: 1,
          updateTime: '2026-06-09 09:00:00'
        }
      ]
    }),
    select: (data: unknown) => data
  })),
  listGlobalItemsByTypeQueryOptions: vi.fn(() => ({
    queryKey: ['dictionary-items', 'payment'],
    queryFn: vi.fn().mockResolvedValue([
      {
        id: 201,
        dictTypeCode: 'payment',
        dictItemCode: 'paid',
        dictItemName: '已支付',
        status: 'ENABLE',
        sort: 10,
        remark: '真实接口返回',
        createBy: 1,
        createTime: '2026-06-09 09:05:00',
        updateBy: 1,
        updateTime: '2026-06-09 09:05:00'
      }
    ]),
    select: (data: unknown) => data
  })),
  createGlobalTypeMutationOptions: vi.fn(() => ({ mutationFn: vi.fn() })),
  updateGlobalTypeMutationOptions: vi.fn(() => ({ mutationFn: vi.fn() })),
  createGlobalItemPreciseInvalidationMutationOptions: vi.fn(() => ({ mutationFn: vi.fn() })),
  updateGlobalItemPreciseInvalidationMutationOptions: vi.fn(() => ({ mutationFn: vi.fn() })),
  deleteGlobalItemMutationOptions: vi.fn(() => ({ mutationFn: vi.fn() })),
  deleteGlobalTypeMutationOptions: vi.fn(() => ({ mutationFn: vi.fn() }))
}));

import DictionaryManagementPage from './dictionary-management-page';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('DictionaryManagementPage render', () => {
  const originalError = console.error;

  beforeEach(() => {
    cleanup();
    localStorage.clear();
    window.localStorage.setItem('app-data-table-per-page', '10');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    } as typeof ResizeObserver;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders a dictionary page with a single item without entering an update loop', async () => {
    const Wrapper = createWrapper();

    render(<DictionaryManagementPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('已支付')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', {
        name: /付款状态 payment/i
      })
    ).toBeInTheDocument();
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );
  });
});
