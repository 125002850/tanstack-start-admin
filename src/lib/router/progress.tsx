import * as React from 'react';
import { useRouterState } from '@tanstack/react-router';

const PROGRESS_SHOW_DELAY_MS = 120;
const PROGRESS_COMPLETE_HIDE_MS = 180;
const PROGRESS_SETTLE_MS = 2500;

const listeners = new Set<() => void>();
let suspensePendingCount = 0;

function emitProgressStoreChange() {
  for (const listener of listeners) listener();
}

function subscribeProgressStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSuspensePendingSnapshot() {
  return suspensePendingCount > 0;
}

function incrementSuspensePending() {
  suspensePendingCount += 1;
  emitProgressStoreChange();

  return () => {
    suspensePendingCount = Math.max(0, suspensePendingCount - 1);
    emitProgressStoreChange();
  };
}

function useSuspensePending() {
  return React.useSyncExternalStore(
    subscribeProgressStore,
    getSuspensePendingSnapshot,
    getSuspensePendingSnapshot
  );
}

export function RouterSuspenseProgressSignal() {
  React.useEffect(() => incrementSuspensePending(), []);
  return null;
}

export function RouterProgressBar() {
  const isRouterPending = useRouterState({
    select: (state) =>
      state.status === 'pending' ||
      state.isLoading ||
      state.isTransitioning ||
      state.matches.some((match) =>
        Boolean((match as unknown as Record<string, unknown>)['_displayPending'])
      )
  });
  const isSuspensePending = useSuspensePending();
  const isPending = isRouterPending || isSuspensePending;
  const [isVisible, setIsVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!isPending) {
      if (!isVisible) return undefined;

      setProgress(1);
      const timeoutId = window.setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, PROGRESS_COMPLETE_HIDE_MS);

      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
      setProgress(0.12);

      window.requestAnimationFrame(() => {
        setProgress(0.72);
      });
    }, PROGRESS_SHOW_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isPending, isVisible]);

  React.useEffect(() => {
    if (!isPending || !isVisible) return undefined;

    const timeoutId = window.setTimeout(() => {
      setProgress(0.88);
    }, PROGRESS_SETTLE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isPending, isVisible]);

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden'
    >
      <div
        className='bg-primary h-full origin-left transition-[transform,opacity] duration-300 ease-out'
        style={{
          opacity: isVisible ? 1 : 0,
          transform: `scaleX(${progress})`
        }}
      />
    </div>
  );
}
