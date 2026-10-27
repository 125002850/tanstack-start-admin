import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const blocker = {
    proceed: vi.fn(),
    reset: vi.fn(),
    status: 'idle' as 'idle' | 'blocked'
  };
  const updateLifecycle = vi.fn();
  return { blocker, updateLifecycle };
});

vi.mock('@tanstack/react-router', () => ({
  useBlocker: () => mock.blocker
}));

vi.mock('@/features/workspace-tabs/hooks/use-workspace-page', () => ({
  useWorkspacePage: () => ({
    active: true,
    tabId: 'page-1',
    updateLifecycle: mock.updateLifecycle
  }),
  useWorkspacePageLifecycle: () => ({
    tabId: 'page-1',
    updateLifecycle: mock.updateLifecycle
  })
}));

import { useWorkspaceDirtyGuard } from './use-workspace-dirty-guard';

afterEach(() => {
  cleanup();
  mock.blocker.status = 'idle';
  mock.blocker.proceed.mockReset();
  mock.blocker.reset.mockReset();
  mock.updateLifecycle.mockReset();
});

describe('useWorkspaceDirtyGuard', () => {
  it('exposes a navigate confirm state while a navigation is blocked', () => {
    mock.blocker.status = 'blocked';
    const { result } = renderHook(() => useWorkspaceDirtyGuard(true));

    expect(result.current.confirmState).toEqual({ kind: 'navigate' });

    act(() => result.current.confirmDiscard());

    expect(mock.blocker.proceed).toHaveBeenCalledOnce();
  });

  it('lets cancelDiscard reset a blocked navigation', () => {
    mock.blocker.status = 'blocked';
    const { result } = renderHook(() => useWorkspaceDirtyGuard(true));

    act(() => result.current.cancelDiscard());

    expect(mock.blocker.reset).toHaveBeenCalledOnce();
  });

  it('registers a closeGuard that resolves true when the user confirms discarding', async () => {
    const { result } = renderHook(() => useWorkspaceDirtyGuard(true));
    const patch = mock.updateLifecycle.mock.calls.at(-1)?.[0] as {
      closeGuard: (context: { tabId: string; reason: string }) => boolean | Promise<boolean>;
    };

    let keep: boolean | undefined;
    let promise: Promise<boolean>;
    act(() => {
      promise = Promise.resolve(
        patch.closeGuard({ tabId: 'page-1', reason: 'close-current' })
      ) as Promise<boolean>;
    });

    expect(result.current.confirmState).toEqual({ kind: 'close', reason: 'close-current' });

    await act(async () => {
      result.current.confirmDiscard();
      keep = await promise;
    });

    expect(keep).toBe(true);
  });

  it('resolves the closeGuard to false when the user cancels', async () => {
    const { result } = renderHook(() => useWorkspaceDirtyGuard(true));
    const patch = mock.updateLifecycle.mock.calls.at(-1)?.[0] as {
      closeGuard: (context: { tabId: string; reason: string }) => boolean | Promise<boolean>;
    };

    let keep: boolean | undefined;
    let promise: Promise<boolean>;
    act(() => {
      promise = Promise.resolve(
        patch.closeGuard({ tabId: 'page-1', reason: 'close-other' })
      ) as Promise<boolean>;
    });

    expect(result.current.confirmState).toEqual({ kind: 'close', reason: 'close-other' });

    await act(async () => {
      result.current.cancelDiscard();
      keep = await promise;
    });

    expect(keep).toBe(false);
  });

  it('returns true from the closeGuard when the draft is not dirty', () => {
    const { result } = renderHook(() => useWorkspaceDirtyGuard(false));
    const patch = mock.updateLifecycle.mock.calls.at(-1)?.[0] as {
      closeGuard: (context: { tabId: string; reason: string }) => boolean | Promise<boolean>;
    };

    expect(patch.closeGuard({ tabId: 'page-1', reason: 'close-current' })).toBe(true);
    expect(result.current.confirmState).toBeNull();
  });
});

it('shows a refresh-specific confirmation and waits for the user decision', async () => {
  const { result } = renderHook(() => useWorkspaceDirtyGuard(true));
  const patch = mock.updateLifecycle.mock.calls.at(-1)![0];
  let decision!: Promise<boolean>;
  act(() => {
    decision = patch.closeGuard({ tabId: 'page-1', reason: 'refresh' });
  });
  expect(result.current.confirmState).toEqual({ kind: 'refresh' });
  await act(async () => {
    result.current.cancelDiscard();
    expect(await decision).toBe(false);
  });
});
