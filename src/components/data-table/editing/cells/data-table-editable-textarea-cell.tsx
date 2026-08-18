import type { CellContext } from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupTextarea } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataTableEditorKeyboardShell } from '@/components/data-table/editing/cells/data-table-editor-keyboard-shell';
import { renderDataTableTextCell } from '@/components/data-table/cells/data-table-text-cell';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { cn } from '@/lib/utils';
import type {
  DataTableEditableTextareaColumnMeta,
  DataTableEditingRuntime,
  DataTableFinishEditingResult
} from '../types';

function shouldRestoreTextareaCellFocus(result: DataTableFinishEditingResult) {
  return (
    result.status === 'committed' || result.status === 'unchanged' || result.status === 'reverted'
  );
}

function focusConnectedCell(cell: HTMLTableCellElement | null) {
  if (!cell?.isConnected) return;
  queueMicrotask(() => {
    if (cell.isConnected) cell.focus({ preventScroll: true });
  });
}

function TextareaEditor<TData>({
  config,
  runtime
}: {
  config: DataTableEditableTextareaColumnMeta<TData>;
  runtime: DataTableEditingRuntime<TData>;
}) {
  const activeCell = runtime.activeCell;
  const [open, setOpen] = React.useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const ownerCellRef = React.useRef<HTMLTableCellElement | null>(null);
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const sessionId = activeCell?.sessionId;
  const errorId = React.useId();
  const helpId = React.useId();

  const setAnchorNode = React.useCallback(
    (node: HTMLButtonElement | null) => {
      setTriggerNode(node);
      if (node) ownerCellRef.current = node.closest('td');
    },
    [setTriggerNode]
  );

  if (!activeCell || sessionId === undefined) return null;

  const draftValue = typeof activeCell.draftValue === 'string' ? activeCell.draftValue : '';
  const errors = activeCell.validationErrors;
  const isInvalid = activeCell.parseState === 'invalid';
  const portalContainer = open ? (container ?? getContainer()) : container;

  const cancel = () => {
    runtime.cancelEditing(sessionId);
    focusConnectedCell(ownerCellRef.current);
  };
  const confirm = () => {
    const result = runtime.finishEditing(sessionId, 'enter');
    if (shouldRestoreTextareaCellFocus(result)) {
      focusConnectedCell(ownerCellRef.current);
    } else {
      queueMicrotask(() => textareaRef.current?.focus({ preventScroll: true }));
    }
  };

  return (
    <DataTableEditorKeyboardShell
      runtime={runtime}
      sessionId={sessionId}
      profile='multiline'
      slot='data-table-textarea-editor'
      onAnchorDetach={() => setOpen(false)}
    >
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen && runtime.activeCell?.sessionId === sessionId) cancel();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            ref={setAnchorNode}
            type='button'
            variant='outline'
            tabIndex={-1}
            aria-label={`打开${config.title}多行编辑器`}
            className='h-full w-full min-w-0 justify-start rounded-[2px] border-2 border-primary bg-background px-[15px] font-normal shadow-none ring-[3px] ring-primary/25'
          >
            <span className='min-w-0 truncate'>{draftValue || '-'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          role='dialog'
          aria-modal='false'
          aria-label={`${config.title}多行文本编辑器`}
          align='start'
          container={portalContainer}
          finalFocus={triggerRef}
          className='max-h-[min(70vh,32rem)] w-[min(28rem,calc(100vw-2rem))] min-w-[var(--radix-popover-trigger-width)] overflow-auto p-3'
          data-row-expand-ignore
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            textareaRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            cancel();
          }}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onWheelCapture={(event) => event.stopPropagation()}
        >
          <InputGroup
            className={cn(
              'items-stretch',
              isInvalid && 'border-destructive ring-3 ring-destructive/20'
            )}
          >
            <InputGroupTextarea
              ref={textareaRef}
              aria-label={`编辑${config.title}`}
              aria-invalid={isInvalid}
              aria-describedby={`${helpId}${isInvalid ? ` ${errorId}` : ''}`}
              rows={config.rows}
              cols={config.cols}
              maxLength={config.maxLength}
              value={draftValue}
              onChange={(event) => {
                const nextDraft =
                  config.maxLength === undefined
                    ? event.currentTarget.value
                    : event.currentTarget.value.slice(0, config.maxLength);
                runtime.setActiveDraft(sessionId, nextDraft);
              }}
              className='min-h-32 max-h-[min(50vh,24rem)] resize-y'
            />
          </InputGroup>
          <div className='mt-2 flex min-w-0 items-start justify-between gap-3 text-xs'>
            <div className='min-w-0'>
              <p id={helpId} className='text-muted-foreground'>
                Enter 换行，Ctrl/Cmd + Enter 提交
              </p>
              {isInvalid ? (
                <p id={errorId} role='alert' className='mt-1 text-destructive'>
                  {errors[0]}
                </p>
              ) : null}
            </div>
            <span aria-live='polite' className='shrink-0 text-muted-foreground'>
              {config.maxLength === undefined
                ? `${draftValue.length} 字符`
                : `${draftValue.length} / ${config.maxLength}`}
            </span>
          </div>
          <div className='mt-3 flex justify-end gap-2'>
            <Button type='button' variant='outline' size='sm' onClick={cancel}>
              取消
            </Button>
            <Button type='button' size='sm' onClick={confirm}>
              确认
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </DataTableEditorKeyboardShell>
  );
}

export function DataTableEditableTextareaCell<TData, TValue>({
  context,
  formattedValue,
  className
}: {
  context: CellContext<TData, TValue>;
  formattedValue?: unknown;
  className?: string;
}) {
  const config = context.column.columnDef.meta?.editableCell;
  const runtime = context.table.options.meta?.dataTableEditing;
  if (!config || config.editor !== 'textarea') return null;

  const value = context.getValue();
  const activeCell = runtime?.activeCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;

  if (isActive && runtime) {
    return <TextareaEditor config={config} runtime={runtime} />;
  }

  return (
    <div data-slot='data-table-textarea-display' className='min-w-0 truncate'>
      {renderDataTableTextCell(formattedValue ?? value, className)}
    </div>
  );
}
