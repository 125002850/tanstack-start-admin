import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import type { WorkspaceDirtyConfirmState } from '../hooks/use-workspace-dirty-guard';

export interface WorkspaceDirtyGuardDialogProps {
  readonly subject?: string;
  readonly testId?: string;
  readonly confirmState: WorkspaceDirtyConfirmState | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function WorkspaceDirtyGuardDialog({
  confirmState,
  subject = '页面',
  testId = 'workspace-dirty-guard-dialog',
  onCancel,
  onConfirm
}: WorkspaceDirtyGuardDialogProps) {
  const copy = confirmState === null ? null : DIRTY_CONFIRM_COPY[confirmState.kind];

  return (
    <AlertDialog
      open={confirmState !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy?.description.replace('{subject}', subject)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy?.cancelLabel}</AlertDialogCancel>
          <Button onClick={onConfirm} type='button' variant='destructive'>
            {copy?.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const DIRTY_CONFIRM_COPY: Record<
  WorkspaceDirtyConfirmState['kind'],
  {
    readonly cancelLabel: string;
    readonly confirmLabel: string;
    readonly description: string;
    readonly title: string;
  }
> = {
  navigate: {
    title: '离开当前页面？',
    description: '当前{subject}有未保存更改，离开后将丢失这些更改。',
    confirmLabel: '放弃更改并离开',
    cancelLabel: '留在页面'
  },
  refresh: {
    title: '刷新页面？',
    description: '当前{subject}有未保存更改，刷新后将丢失这些更改。',
    confirmLabel: '放弃更改并刷新',
    cancelLabel: '取消'
  },
  close: {
    title: '关闭页面？',
    description: '当前{subject}有未保存更改，关闭后将丢失这些更改。',
    confirmLabel: '放弃更改并关闭',
    cancelLabel: '取消'
  }
};
