import * as React from 'react';

import { AlertModal } from '@/components/modal/alert-modal';

type ConfirmTextResolver<TArgs extends unknown[]> = string | ((...args: TArgs) => string);

interface ConfirmActionOptions<TArgs extends unknown[]> {
  title?: ConfirmTextResolver<TArgs>;
  description?: ConfirmTextResolver<TArgs>;
  confirmText?: ConfirmTextResolver<TArgs>;
  cancelText?: ConfirmTextResolver<TArgs>;
  run: (...args: TArgs) => void | Promise<void>;
}

interface PendingConfirmAction<TArgs extends unknown[]> {
  args: TArgs;
  options: ConfirmActionOptions<TArgs>;
}

function resolveConfirmText<TArgs extends unknown[]>(
  value: ConfirmTextResolver<TArgs> | undefined,
  args: TArgs,
  fallback: string
): string {
  if (typeof value === 'function') {
    return value(...args);
  }

  return value ?? fallback;
}

export function useConfirmAction<TArgs extends unknown[] = []>() {
  const [pendingAction, setPendingAction] = React.useState<PendingConfirmAction<TArgs> | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const withConfirm = React.useCallback(
    (options: ConfirmActionOptions<TArgs>) =>
      (...args: TArgs) => {
        setPendingAction({ args, options });
      },
    []
  );

  const handleClose = React.useCallback(() => {
    if (isLoading) return;
    setPendingAction(null);
  }, [isLoading]);

  const handleConfirm = React.useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    try {
      await pendingAction.options.run(...pendingAction.args);
      setPendingAction(null);
    } finally {
      setIsLoading(false);
    }
  }, [pendingAction]);

  const confirmDialog = pendingAction ? (
    <AlertModal
      isOpen
      onClose={handleClose}
      onConfirm={handleConfirm}
      loading={isLoading}
      title={resolveConfirmText(pendingAction.options.title, pendingAction.args, '确认执行该操作？')}
      description={resolveConfirmText(
        pendingAction.options.description,
        pendingAction.args,
        '此操作不可撤销。'
      )}
      confirmText={resolveConfirmText(pendingAction.options.confirmText, pendingAction.args, '继续')}
      cancelText={resolveConfirmText(pendingAction.options.cancelText, pendingAction.args, '取消')}
    />
  ) : null;

  return { withConfirm, confirmDialog };
}
