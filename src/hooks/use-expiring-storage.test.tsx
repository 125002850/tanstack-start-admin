import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createExpiringStorage,
  useExpiringStorage,
  type ExpiringStorageAdapter
} from './use-expiring-storage';

const STORAGE_KEY = 'test:expiring-storage';
const TTL_MS = 60_000;

interface TestValue {
  readonly id: string;
  readonly createdAt: number;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 7, 31, 8, 0, 0));
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('expiring storage', () => {
  it('supports isolated local and session storage backends', async () => {
    const localClient = createTestClient('local');
    const sessionClient = createTestClient('session');

    await localClient.replace([{ id: 'local-value', createdAt: Date.now() }]);
    await sessionClient.replace([{ id: 'session-value', createdAt: Date.now() }]);

    expect((await localClient.read()).values.map((value) => value.id)).toEqual(['local-value']);
    expect((await sessionClient.read()).values.map((value) => value.id)).toEqual(['session-value']);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('local-value');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('session-value');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('session-value');
  });

  it('expires at the exact TTL boundary and removes the physical key lazily', async () => {
    const client = createTestClient('local');
    await client.replace([{ id: 'expiring-value', createdAt: Date.now() }]);

    vi.advanceTimersByTime(TTL_MS);

    await expect(client.read()).resolves.toEqual({ success: true, values: [] });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('accepts an asynchronous adapter compatible with a future IndexedDB implementation', async () => {
    const values = new Map<string, string>();
    const asyncAdapter: ExpiringStorageAdapter = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        values.set(key, value);
      },
      async removeItem(key) {
        values.delete(key);
      }
    };
    const client = createTestClient(asyncAdapter);

    await expect(
      client.replace([{ id: 'async-value', createdAt: Date.now() }])
    ).resolves.toMatchObject({ success: true });
    expect((await client.read()).values.map((value) => value.id)).toEqual(['async-value']);

    vi.advanceTimersByTime(TTL_MS);
    await expect(client.read()).resolves.toEqual({ success: true, values: [] });
    expect(values.has(STORAGE_KEY)).toBe(false);
  });

  it('keeps React state synchronized with client mutations', async () => {
    const client = createTestClient('local');
    const { result } = renderHook(() => useExpiringStorage(client));

    await act(async () => {
      await result.current.reload();
    });
    await act(async () => {
      await result.current.update((values) => [
        ...values,
        { id: 'hook-value', createdAt: Date.now() }
      ]);
    });

    expect(result.current.values.map((value) => value.id)).toEqual(['hook-value']);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not expose values owned by the previous client while a new client is loading', async () => {
    const firstClient = createTestClient('local', STORAGE_KEY + ':first');
    await firstClient.replace([{ id: 'first-value', createdAt: Date.now() }]);

    let resolveSecondRead!: (value: string | null) => void;
    const secondRead = new Promise<string | null>((resolve) => {
      resolveSecondRead = resolve;
    });
    const secondClient = createTestClient(
      {
        getItem() {
          return secondRead;
        },
        setItem() {},
        removeItem() {}
      },
      STORAGE_KEY + ':second'
    );
    const { result, rerender } = renderHook(({ client }) => useExpiringStorage(client), {
      initialProps: { client: firstClient }
    });

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.values.map((value) => value.id)).toEqual(['first-value']);

    rerender({ client: secondClient });
    expect(result.current.values).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSecondRead(null);
      await secondRead;
    });
    expect(result.current.values).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

function createTestClient(
  storage: 'local' | 'session' | ExpiringStorageAdapter,
  key = STORAGE_KEY
) {
  return createExpiringStorage<TestValue>({
    key,
    storage,
    ttlMs: TTL_MS,
    getCreatedAt: (value) => value.createdAt,
    isValue: isTestValue
  });
}

function isTestValue(value: unknown): value is TestValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).createdAt === 'number'
  );
}
