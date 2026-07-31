import * as React from 'react';

import { finishEditingAndNavigate } from '@/components/ui/table/core/data-table-editor-navigation';
import { cn } from '@/lib/utils';
import type { DataTableFinishEditingResult, DataTableEditingRuntime } from '@/types/data-table';

export type DataTableEditorKeymapProfile =
  | 'singleLine'
  | 'choice'
  | 'multiline'
  | 'numeric'
  | 'date';

function shouldCommitEnter(
  profile: DataTableEditorKeymapProfile,
  event: React.KeyboardEvent<HTMLDivElement>
) {
  if (profile === 'singleLine' || profile === 'numeric' || profile === 'date') return true;
  return profile === 'multiline' && (event.ctrlKey || event.metaKey);
}

function focusCurrentCell(root: HTMLDivElement | null) {
  root
    ?.closest<HTMLTableCellElement>('td[data-cell-editable="true"]')
    ?.focus({ preventScroll: true });
}

function restoreFocusAfterFinish(
  result: DataTableFinishEditingResult,
  root: HTMLDivElement | null
) {
  if (
    result.status === 'committed' ||
    result.status === 'unchanged' ||
    result.status === 'reverted'
  ) {
    queueMicrotask(() => focusCurrentCell(root));
  }
}

export function DataTableEditorKeyboardShell<TData>({
  children,
  runtime,
  sessionId,
  profile,
  slot = 'data-table-editor-keyboard-shell',
  className,
  onAnchorDetach
}: {
  children: React.ReactNode;
  runtime: DataTableEditingRuntime<TData>;
  sessionId: number;
  profile: DataTableEditorKeymapProfile;
  slot?: string;
  className?: string;
  onAnchorDetach?: () => void;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const onAnchorDetachRef = React.useRef(onAnchorDetach);
  onAnchorDetachRef.current = onAnchorDetach;
  const registerEditorAnchor = runtime.registerEditorAnchor;

  React.useLayoutEffect(
    () =>
      registerEditorAnchor(sessionId, {
        closePopup: () => onAnchorDetachRef.current?.()
      }),
    [registerEditorAnchor, sessionId]
  );

  return (
    <div
      ref={rootRef}
      role='presentation'
      data-row-expand-ignore
      data-slot={slot}
      className={cn('absolute inset-0 min-w-0 bg-background', className)}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          runtime.activeCell?.sessionId !== sessionId
        ) {
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          runtime.cancelEditing(sessionId);
          queueMicrotask(() => focusCurrentCell(rootRef.current));
          return;
        }

        if (event.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
          const cell = rootRef.current?.closest<HTMLTableCellElement>(
            'td[data-cell-editable="true"]'
          );
          finishEditingAndNavigate({
            runtime,
            sessionId,
            cell: cell ?? null,
            direction: event.shiftKey ? 'previous' : 'next'
          });
          return;
        }

        if (event.key === 'Enter' && shouldCommitEnter(profile, event)) {
          event.preventDefault();
          event.stopPropagation();
          const result = runtime.finishEditing(sessionId, 'enter');
          restoreFocusAfterFinish(result, rootRef.current);
        }
      }}
    >
      {children}
    </div>
  );
}
