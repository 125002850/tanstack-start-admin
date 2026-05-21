import { useCallback, useEffect, useRef, useState } from 'react';
import { useCallbackRef } from '@/hooks/use-callback-ref';
import { usePageCacheSlot } from './use-page-cache-slot';

export type PageCacheScrollAxis = 'both' | 'x' | 'y';

export type PageCacheScrollSnapshot = {
  scrollTop: number;
  scrollLeft: number;
};

export type UsePageCacheScrollOptions = {
  slot: string;
  selector?: string;
  getTarget?: () => HTMLElement | null;
  axis?: PageCacheScrollAxis;
  ready?: boolean;
};

const DEFAULT_AXIS: PageCacheScrollAxis = 'both';
const SCROLL_SAVE_THROTTLE_MS = 150;
const SCROLL_RESTORE_SETTLE_MS = 1500;
const EMPTY_SCROLL_SNAPSHOT: PageCacheScrollSnapshot = {
  scrollTop: 0,
  scrollLeft: 0
};

function readScrollSnapshot(target: HTMLElement | null): PageCacheScrollSnapshot {
  if (!target) {
    return EMPTY_SCROLL_SNAPSHOT;
  }

  return {
    scrollTop: target.scrollTop,
    scrollLeft: target.scrollLeft
  };
}

function restoreScrollSnapshot(
  target: HTMLElement,
  snapshot: PageCacheScrollSnapshot,
  axis: PageCacheScrollAxis
) {
  if (axis === 'both' || axis === 'y') {
    target.scrollTop = snapshot.scrollTop;
  }

  if (axis === 'both' || axis === 'x') {
    target.scrollLeft = snapshot.scrollLeft;
  }
}

export function usePageCacheScroll({
  slot,
  selector,
  getTarget,
  axis = DEFAULT_AXIS,
  ready = true
}: UsePageCacheScrollOptions) {
  const axisRef = useRef(axis);
  const getTargetRef = useCallbackRef(getTarget);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const restoredTargetRef = useRef<HTMLElement | null>(null);
  const isRestoringRef = useRef(false);
  const lastSaveAtRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const restoreFrameRef = useRef<number | null>(null);
  const restoreTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const restoreCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    axisRef.current = axis;
  }, [axis]);

  const resolveTarget = useCallback(() => {
    const explicitTarget = getTargetRef?.();
    if (explicitTarget) {
      return explicitTarget;
    }

    if (!selector || typeof document === 'undefined') {
      return null;
    }

    return document.querySelector<HTMLElement>(selector);
  }, [getTargetRef, selector]);

  const stopRestoreSettlement = useCallback(() => {
    isRestoringRef.current = false;

    if (typeof window !== 'undefined' && restoreFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFrameRef.current);
      restoreFrameRef.current = null;
    }

    if (typeof window !== 'undefined' && restoreTimeoutRef.current !== null) {
      window.clearTimeout(restoreTimeoutRef.current);
      restoreTimeoutRef.current = null;
    }

    restoreCleanupRef.current?.();
    restoreCleanupRef.current = null;
  }, []);

  const beginRestoreSettlement = useCallback(
    (snapshot: PageCacheScrollSnapshot) => {
      const currentTarget = resolveTarget();

      if (!currentTarget || typeof window === 'undefined') {
        return;
      }

      stopRestoreSettlement();
      isRestoringRef.current = true;

      const cancelSettlement = () => {
        stopRestoreSettlement();
      };

      currentTarget.addEventListener('wheel', cancelSettlement, { passive: true });
      currentTarget.addEventListener('touchstart', cancelSettlement, { passive: true });
      currentTarget.addEventListener('pointerdown', cancelSettlement, { passive: true });

      restoreCleanupRef.current = () => {
        currentTarget.removeEventListener('wheel', cancelSettlement);
        currentTarget.removeEventListener('touchstart', cancelSettlement);
        currentTarget.removeEventListener('pointerdown', cancelSettlement);
      };

      const applySnapshot = () => {
        const nextTarget = resolveTarget();

        if (!nextTarget || nextTarget !== currentTarget) {
          stopRestoreSettlement();
          return;
        }

        restoreScrollSnapshot(currentTarget, snapshot, axisRef.current);
        restoreFrameRef.current = window.requestAnimationFrame(applySnapshot);
      };

      restoreScrollSnapshot(currentTarget, snapshot, axisRef.current);
      restoreFrameRef.current = window.requestAnimationFrame(applySnapshot);
      restoreTimeoutRef.current = window.setTimeout(() => {
        restoreScrollSnapshot(currentTarget, snapshot, axisRef.current);
        stopRestoreSettlement();
      }, SCROLL_RESTORE_SETTLE_MS);
    },
    [resolveTarget, stopRestoreSettlement]
  );

  const {
    cachedValue,
    isReady: isSlotReady,
    restoreFromCache,
    save
  } = usePageCacheSlot<PageCacheScrollSnapshot>({
    slot,
    readCurrent: () => readScrollSnapshot(resolveTarget()),
    restore: (snapshot) => {
      beginRestoreSettlement(snapshot);
    }
  });

  const flushPendingSave = useCallback(() => {
    if (typeof window === 'undefined' || throttleTimerRef.current === null) {
      return;
    }

    window.clearTimeout(throttleTimerRef.current);
    throttleTimerRef.current = null;
    lastSaveAtRef.current = Date.now();
    save();
  }, [save]);

  const scheduleSave = useCallback(() => {
    if (!ready || typeof window === 'undefined') {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastSaveAtRef.current;

    if (elapsed >= SCROLL_SAVE_THROTTLE_MS) {
      if (throttleTimerRef.current !== null) {
        window.clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }

      lastSaveAtRef.current = now;
      save();
      return;
    }

    if (throttleTimerRef.current !== null) {
      return;
    }

    throttleTimerRef.current = window.setTimeout(() => {
      throttleTimerRef.current = null;
      lastSaveAtRef.current = Date.now();
      save();
    }, SCROLL_SAVE_THROTTLE_MS - elapsed);
  }, [ready, save]);

  useEffect(
    () => () => {
      stopRestoreSettlement();
      flushPendingSave();
    },
    [flushPendingSave, stopRestoreSettlement]
  );

  useEffect(() => {
    if (!ready) {
      stopRestoreSettlement();
      restoredTargetRef.current = null;
      setTarget(null);
      return;
    }

    let isCancelled = false;
    let frameId: number | null = null;

    const syncTarget = () => {
      if (isCancelled) {
        return;
      }

      const nextTarget = resolveTarget();
      setTarget((currentTarget) => (currentTarget === nextTarget ? currentTarget : nextTarget));

      if (!nextTarget && typeof window !== 'undefined') {
        frameId = window.requestAnimationFrame(syncTarget);
      }
    };

    syncTarget();

    return () => {
      isCancelled = true;

      if (frameId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [ready, resolveTarget, stopRestoreSettlement]);

  useEffect(() => {
    if (!ready || !isSlotReady || !target) {
      return;
    }

    if (restoredTargetRef.current === target) {
      return;
    }

    restoredTargetRef.current = target;

    if (!cachedValue) {
      return;
    }

    restoreFromCache();
  }, [cachedValue, isSlotReady, ready, restoreFromCache, target]);

  useEffect(() => {
    if (!ready || !target) {
      return;
    }

    const handleScroll = () => {
      if (isRestoringRef.current) {
        return;
      }

      scheduleSave();
    };

    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
      flushPendingSave();
    };
  }, [flushPendingSave, ready, scheduleSave, target]);
}
