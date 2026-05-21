import { useCallback, useEffect, useRef, useState } from 'react';
import { useCallbackRef } from '@/hooks/use-callback-ref';
import { usePageCache } from './use-page-cache';

type PageCacheSlotPrimitive = boolean | null | number | string;
export type PageCacheStoredValue =
  | PageCacheSlotPrimitive
  | PageCacheStoredValue[]
  | { [key: string]: PageCacheStoredValue };
export type PageCacheSlotValue =
  | PageCacheSlotPrimitive
  | PageCacheSlotValue[]
  | { [key: string]: PageCacheSlotValue | undefined };

export type UsePageCacheSlotOptions<T extends PageCacheSlotValue> = {
  slot: string;
  readCurrent: () => T;
  restore: (snapshot: T) => void;
  enabled?: boolean;
  debounceMs?: number;
};

export type UsePageCacheSlotResult<T extends PageCacheSlotValue> = {
  cachedValue: T | undefined;
  isReady: boolean;
  restoreFromCache: () => void;
  save: () => void;
  clear: () => void;
};

function normalizePageCacheSlotValue(value: PageCacheSlotValue): PageCacheStoredValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePageCacheSlotValue(item));
  }

  const entries = Object.entries(value).flatMap(([key, entryValue]) => {
    if (entryValue === undefined) {
      return [];
    }

    return [[key, normalizePageCacheSlotValue(entryValue)] as const];
  });

  return Object.fromEntries(entries);
}

// Generic slot primitive for page-local state. Feature hooks decide when to restore/save.
export function usePageCacheSlot<T extends PageCacheSlotValue>({
  slot,
  readCurrent,
  restore,
  enabled = true,
  debounceMs
}: UsePageCacheSlotOptions<T>): UsePageCacheSlotResult<T> {
  const { readSlot, writeSlot, deleteSlot } = usePageCache();
  const [cachedValue, setCachedValue] = useState<T | undefined>(undefined);
  const [isReady, setIsReady] = useState(!enabled);
  const readCurrentRef = useCallbackRef(readCurrent);
  const restoreRef = useCallbackRef(restore);
  const debounceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const cancelPendingSave = useCallback(() => {
    if (typeof window === 'undefined' || debounceTimerRef.current === null) return;

    window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
  }, []);

  const persistCurrentValue = useCallback(() => {
    if (!enabled) return;

    const currentValue = readCurrentRef();
    const storedValue = normalizePageCacheSlotValue(currentValue);

    writeSlot<PageCacheStoredValue>(slot, storedValue);
    setCachedValue(storedValue as T);
  }, [enabled, readCurrentRef, slot, writeSlot]);

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current === null) return;

    cancelPendingSave();
    persistCurrentValue();
  }, [cancelPendingSave, persistCurrentValue]);

  useEffect(() => () => flushPendingSave(), [flushPendingSave]);

  useEffect(() => {
    cancelPendingSave();

    if (!enabled) {
      setCachedValue(undefined);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    setCachedValue(readSlot<T>(slot));
    setIsReady(true);
  }, [cancelPendingSave, enabled, readSlot, slot]);

  const restoreFromCache = useCallback(() => {
    if (!enabled || cachedValue === undefined) return;
    restoreRef(cachedValue);
  }, [cachedValue, enabled, restoreRef]);

  const save = useCallback(() => {
    if (!enabled) return;

    cancelPendingSave();

    if ((debounceMs ?? 0) > 0) {
      if (typeof window === 'undefined') return;
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        persistCurrentValue();
      }, debounceMs);
      return;
    }

    persistCurrentValue();
  }, [cancelPendingSave, debounceMs, enabled, persistCurrentValue]);

  const clear = useCallback(() => {
    cancelPendingSave();
    setCachedValue(undefined);

    if (!enabled) return;
    deleteSlot(slot);
  }, [cancelPendingSave, deleteSlot, enabled, slot]);

  return {
    cachedValue,
    isReady,
    restoreFromCache,
    save,
    clear
  };
}
