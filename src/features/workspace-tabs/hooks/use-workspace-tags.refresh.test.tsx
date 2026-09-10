import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorkspaceTags } from './use-workspace-tags';
import { useWorkspaceTabStore } from '../utils/store';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  invalidate: vi.fn(),
  error: vi.fn(),
  subscribe: vi.fn(),
  state: { isLoading: false, isTransitioning: false }
}));
let client: QueryClient;
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    state: mocks.state,
    latestLocation: { href: '/dashboard/target' },
    buildLocation: ({ to }: { to: string }) => ({ href: to }),
    subscribe: mocks.subscribe,
    navigate: mocks.navigate,
    invalidate: mocks.invalidate,
    options: { context: { queryClient: client } }
  })
}));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));
const target = { id: '/dashboard/target', href: '/dashboard/target', title: 'Target' };
const other = { id: '/dashboard/other', href: '/dashboard/other', title: 'Other' };
const subscriptions: Array<() => void> = [];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.state.isLoading = false;
  mocks.state.isTransitioning = false;
  useWorkspaceTabStore.getState().resetAll();
  useWorkspaceTabStore.getState().openOrActivate(other);
  useWorkspaceTabStore.getState().openOrActivate(target);
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  mocks.navigate.mockImplementation(async ({ to }: { to: string }) => {
    useWorkspaceTabStore.getState().openOrActivate(to === target.href ? target : other);
  });
  mocks.invalidate.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  client.clear();
  useWorkspaceTabStore.getState().resetAll();
});

async function query(name: string, active: boolean) {
  const queryFn = vi.fn().mockResolvedValue('before');
  const options = { queryKey: [name], queryFn };
  await client.fetchQuery(options);
  if (active) subscriptions.push(new QueryObserver(client, options).subscribe(() => {}));
  queryFn.mockResolvedValue('after');
  return queryFn;
}

it('refetches fresh active queries and loaders without navigating or invalidating inactive caches', async () => {
  const activeQuery = await query('target', true);
  const inactiveQuery = await query('other', false);
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh(target.id));
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(mocks.invalidate).toHaveBeenCalledWith({ sync: true });
  expect(useWorkspaceTabStore.getState().tabs[target.id].renderVersion).toBe(1);
  expect(useWorkspaceTabStore.getState().tabs[other.id].renderVersion).toBeUndefined();
  expect(activeQuery).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(['target'])).toBe('after');
  expect(inactiveQuery).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(['other'])?.isInvalidated).toBe(false);
});

it('activates a background tab before refreshing its queries', async () => {
  useWorkspaceTabStore.getState().openOrActivate(other);
  const queryFn = await query('target', false);
  mocks.navigate.mockImplementation(async () => {
    useWorkspaceTabStore.getState().openOrActivate(target);
    subscriptions.push(
      new QueryObserver(client, { queryKey: ['target'], queryFn }).subscribe(() => {})
    );
  });
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh(target.id));
  expect(mocks.navigate).toHaveBeenCalledWith({ to: target.href });
  expect(queryFn).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(['target'])).toBe('after');
});

it('does not refresh another page if the user switches tabs while loaders are refreshing', async () => {
  const queryFn = await query('target', true);
  mocks.invalidate.mockImplementation(async () => {
    useWorkspaceTabStore.getState().openOrActivate(other);
  });
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh(target.id));
  expect(queryFn).toHaveBeenCalledTimes(1);
});

it('ignores missing tabs', async () => {
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh('missing'));
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(mocks.invalidate).not.toHaveBeenCalled();
});

it('reports navigation failures instead of leaving an unhandled rejection', async () => {
  useWorkspaceTabStore.getState().openOrActivate(other);
  mocks.navigate.mockRejectedValue(new Error('Navigation failed'));
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh(target.id));
  expect(mocks.error).toHaveBeenCalledWith('刷新页面失败，请重试');
  expect(mocks.invalidate).not.toHaveBeenCalled();
});

it('keeps the page and data unchanged when the user rejects discarding edits', async () => {
  const guard = vi.fn().mockResolvedValue(false);
  useWorkspaceTabStore.getState().updateLifecycle(target.id, { dirty: true, closeGuard: guard });
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh(target.id));
  expect(guard).toHaveBeenCalledWith({ tabId: target.id, reason: 'refresh' });
  expect(mocks.invalidate).not.toHaveBeenCalled();
  expect(useWorkspaceTabStore.getState().tabs[target.id].renderVersion).toBeUndefined();
  expect(useWorkspaceTabStore.getState().lifecycleSnapshots[target.id].dirty).toBe(true);
});

it('waits for the background tab transition to commit before recreating its tree', async () => {
  useWorkspaceTabStore.getState().openOrActivate(other);
  mocks.navigate.mockImplementation(async () => {
    mocks.state.isTransitioning = true;
  });
  const unsubscribe = vi.fn();
  mocks.subscribe.mockImplementation((_event, _listener) => {
    queueMicrotask(() => {
      useWorkspaceTabStore.getState().openOrActivate(target);
      mocks.state.isTransitioning = false;
      // workspace store 激活即解除等待。
    });
    return unsubscribe;
  });
  const { result } = renderHook(useWorkspaceTags);
  await act(() => result.current.refresh(target.id));
  expect(mocks.subscribe).toHaveBeenCalledWith('onBeforeNavigate', expect.any(Function));
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(useWorkspaceTabStore.getState().tabs[target.id].renderVersion).toBe(1);
});
