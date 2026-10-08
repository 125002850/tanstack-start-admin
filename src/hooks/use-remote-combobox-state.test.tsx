import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRemoteComboboxState } from './use-remote-combobox-state';

afterEach(cleanup);

function setup(initial: { open: boolean; preload: boolean; disabled: boolean }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });
  const fetchItems = vi.fn(async ({ pageNo }: { pageNo: number }) => [pageNo]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    (props) =>
      useRemoteComboboxState<number, { pageNo: number }, number[]>({
        ...props,
        debounceMs: 0,
        pageSize: 1,
        buildRequest: ({ pageNo }) => ({ pageNo }),
        queryOptionsFactory: (request) => ({
          queryKey: ['options', request],
          queryFn: () => fetchItems(request)
        }),
        getItems: (data) => data,
        getItemKey: (item) => item,
        getTotal: () => 2
      }),
    { wrapper, initialProps: initial }
  );
  return { ...hook, fetchItems };
}

it('默认关闭时不请求，展开后加载，关闭清空候选项', async () => {
  const { result, rerender, fetchItems } = setup({ open: false, preload: false, disabled: false });
  expect(fetchItems).not.toHaveBeenCalled();
  rerender({ open: true, preload: false, disabled: false });
  await waitFor(() => expect(result.current.items).toEqual([1]));
  rerender({ open: false, preload: false, disabled: false });
  await waitFor(() => expect(result.current.items).toEqual([]));
});

it('预加载首屏并复用缓存，展开后支持加载下一页', async () => {
  const { result, rerender, fetchItems } = setup({ open: false, preload: true, disabled: false });
  await waitFor(() => expect(result.current.items).toEqual([1]));
  act(() => result.current.loadMore());
  expect(fetchItems).toHaveBeenCalledTimes(1);
  rerender({ open: true, preload: true, disabled: false });
  expect(result.current.items).toEqual([1]);
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.items).toEqual([1, 2]));
  expect(result.current.hasMore).toBe(false);
  rerender({ open: false, preload: true, disabled: false });
  await waitFor(() => expect(result.current.items).toEqual([1]));
  expect(fetchItems).toHaveBeenCalledTimes(2);
});

it('disabled 优先于 preload，解除禁用后才预加载', async () => {
  const { result, rerender, fetchItems } = setup({ open: false, preload: true, disabled: true });
  expect(fetchItems).not.toHaveBeenCalled();
  rerender({ open: false, preload: true, disabled: false });
  await waitFor(() => expect(result.current.items).toEqual([1]));
});
