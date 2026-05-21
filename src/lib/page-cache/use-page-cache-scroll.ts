import { useCallback, useEffect, useRef } from 'react';
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
const SCROLL_SAVE_DEBOUNCE_MS = 150;
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
  ready = false
}: UsePageCacheScrollOptions) {
  const getTargetRef = useCallbackRef(getTarget);
  const restoreAttemptedRef = useRef(false);

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
  const {
    cachedValue,
    isReady: isSlotReady,
    save
  } = usePageCacheSlot<PageCacheScrollSnapshot>({
    slot,
    readCurrent: () => readScrollSnapshot(resolveTarget()),
    restore: (snapshot) => {
      const target = resolveTarget();
      if (!target) {
        return;
      }

      restoreScrollSnapshot(target, snapshot, axis);
    },
    debounceMs: SCROLL_SAVE_DEBOUNCE_MS
  });

  useEffect(() => {
    if (!ready) {
      restoreAttemptedRef.current = false;
    }
  }, [ready]);

  useEffect(() => {
    if (!ready || !isSlotReady || restoreAttemptedRef.current) {
      return;
    }

    if (!cachedValue) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const target = resolveTarget();
      if (!target) {
        return;
      }

      restoreScrollSnapshot(target, cachedValue, axis);
      restoreAttemptedRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [axis, cachedValue, isSlotReady, ready, resolveTarget]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const target = resolveTarget();
    if (!target) {
      return;
    }

    const handleScroll = () => {
      save();
    };

    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, [isSlotReady, ready, resolveTarget, save]);
}
