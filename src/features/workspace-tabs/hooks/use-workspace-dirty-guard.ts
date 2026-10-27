import * as React from 'react';
import { useBlocker } from '@tanstack/react-router';

import { useWorkspacePageLifecycle } from '@/features/workspace-tabs/hooks/use-workspace-page';

export type WorkspaceDirtyConfirmState =
  | { readonly kind: 'navigate' }
  | { readonly kind: 'refresh' }
  | {
      readonly kind: 'close';
      readonly reason: 'close-current' | 'close-other' | 'close-all';
    };

export function useWorkspaceDirtyGuard(dirty: boolean) {
  const { tabId, updateLifecycle } = useWorkspacePageLifecycle();
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  const resolveCloseRef = React.useRef<((keep: boolean) => void) | null>(null);
  const [closeConfirm, setCloseConfirm] = React.useState<{
    readonly reason: 'close-current' | 'close-other' | 'close-all' | 'refresh';
  } | null>(null);

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current,
    withResolver: true,
    enableBeforeUnload: () => dirtyRef.current
  });

  const confirmDiscard = React.useCallback(() => {
    if (blocker.status === 'blocked') {
      blocker.proceed();
      return;
    }
    resolveCloseRef.current?.(true);
    resolveCloseRef.current = null;
    setCloseConfirm(null);
  }, [blocker]);

  const cancelDiscard = React.useCallback(() => {
    if (blocker.status === 'blocked') {
      blocker.reset();
      return;
    }
    resolveCloseRef.current?.(false);
    resolveCloseRef.current = null;
    setCloseConfirm(null);
  }, [blocker]);

  const closeGuard = React.useCallback(
    (context: {
      tabId: string;
      reason: 'close-current' | 'close-other' | 'close-all' | 'refresh';
    }): boolean | Promise<boolean> => {
      if (!dirtyRef.current) {
        return true;
      }
      return new Promise<boolean>((resolve) => {
        resolveCloseRef.current = resolve;
        setCloseConfirm({ reason: context.reason });
      });
    },
    []
  );

  React.useEffect(() => {
    updateLifecycle({ dirty, closeGuard });
    return () => updateLifecycle({ dirty: false, closeGuard: () => true });
  }, [dirty, closeGuard, updateLifecycle]);

  const release = React.useCallback(() => {
    dirtyRef.current = false;
    updateLifecycle({ dirty: false, closeGuard: () => true });
  }, [updateLifecycle]);

  const confirmState: WorkspaceDirtyConfirmState | null =
    blocker.status === 'blocked'
      ? { kind: 'navigate' }
      : closeConfirm === null
        ? null
        : closeConfirm.reason === 'refresh'
          ? { kind: 'refresh' }
          : { kind: 'close', reason: closeConfirm.reason };

  return {
    cancelDiscard,
    confirmDiscard,
    confirmState,
    release,
    tabId
  } as const;
}
