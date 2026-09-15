import * as React from 'react';
import { useBlocker } from '@tanstack/react-router';

import { useWorkspacePageLifecycle } from '@/features/workspace-tabs/hooks/use-workspace-page';

export function useWorkCalendarDirtyGuard(dirty: boolean) {
  const { updateLifecycle } = useWorkspacePageLifecycle();
  const dirtyRef = React.useRef(dirty);
  const resolveCloseRef = React.useRef<((discard: boolean) => void) | null>(null);
  const [workspaceClosePending, setWorkspaceClosePending] = React.useState(false);
  dirtyRef.current = dirty;

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current,
    withResolver: true,
    enableBeforeUnload: () => dirtyRef.current
  });

  const closeGuard = React.useCallback((): boolean | Promise<boolean> => {
    if (!dirtyRef.current) return true;
    return new Promise<boolean>((resolve) => {
      resolveCloseRef.current = resolve;
      setWorkspaceClosePending(true);
    });
  }, []);

  React.useEffect(() => {
    updateLifecycle({ dirty, closeGuard });
    return () => updateLifecycle({ dirty: false, closeGuard: () => true });
  }, [closeGuard, dirty, updateLifecycle]);

  const cancelDiscard = React.useCallback(() => {
    if (blocker.status === 'blocked') blocker.reset();
    resolveCloseRef.current?.(false);
    resolveCloseRef.current = null;
    setWorkspaceClosePending(false);
  }, [blocker]);

  const confirmDiscard = React.useCallback(() => {
    if (blocker.status === 'blocked') blocker.proceed();
    resolveCloseRef.current?.(true);
    resolveCloseRef.current = null;
    setWorkspaceClosePending(false);
  }, [blocker]);

  return {
    cancelDiscard,
    confirmDiscard,
    confirmOpen: blocker.status === 'blocked' || workspaceClosePending
  } as const;
}
