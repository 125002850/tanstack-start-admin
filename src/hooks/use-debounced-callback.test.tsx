import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedCallback', () => {
  it('flushes the pending call immediately without invoking it again later', () => {
    vi.useFakeTimers();
    const callback = vi.fn((value: string) => value.length);
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => result.current('123'));
    expect(callback).not.toHaveBeenCalled();

    let flushResult: number | undefined;
    act(() => {
      flushResult = result.current.flush();
    });

    expect(flushResult).toBe(3);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('123');

    act(() => vi.advanceTimersByTime(300));
    expect(callback).toHaveBeenCalledOnce();
  });
});
