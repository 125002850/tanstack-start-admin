import type { CellContext } from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DataTableEditorKeyboardShell } from '@/components/data-table/editing/cells/data-table-editor-keyboard-shell';
import { renderDataTableTextCell } from '@/components/data-table/cells/data-table-text-cell';
import { cn } from '@/lib/utils';
import type {
  DataTableEditableInputColumnMeta,
  DataTableEditableSwitchColumnMeta,
  DataTableEditingRuntime
} from '../types';

const DATA_TABLE_INPUT_CLASS_NAME =
  'h-full min-h-10 rounded-[2px] border-2 border-primary bg-background px-[15px] shadow-none ring-[3px] ring-primary/25 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25';

function activateInputEditor<TData, TValue>(
  context: CellContext<TData, TValue>,
  config: DataTableEditableInputColumnMeta<TData>,
  runtime: DataTableEditingRuntime<TData>,
  value: unknown
) {
  runtime.startEditing({
    rowId: context.row.id,
    row: context.row.original,
    columnId: context.column.id,
    field: config.field,
    initialValue: value,
    editableCell: config
  });
}

function InputEditor<TData>({
  config,
  runtime
}: {
  config: DataTableEditableInputColumnMeta<TData>;
  runtime: DataTableEditingRuntime<TData>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeCell = runtime.activeCell;

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (input.selectionStart !== null) {
      const caretPosition = input.value.length;
      input.setSelectionRange(caretPosition, caretPosition);
    }
  }, []);

  if (!activeCell) return null;
  const { sessionId: activeSessionId, draftValue } = activeCell;

  return (
    <DataTableEditorKeyboardShell
      runtime={runtime}
      sessionId={activeSessionId}
      profile='singleLine'
      slot='data-table-input-editor'
    >
      <Input
        ref={inputRef}
        aria-label={`编辑${config.title}`}
        type={config.inputType}
        inputMode={config.inputMode}
        placeholder={config.placeholder}
        maxLength={config.maxLength}
        value={draftValue == null ? '' : String(draftValue)}
        onChange={(event) => runtime.setActiveDraft(activeSessionId, event.currentTarget.value)}
        onBlur={(event) => {
          runtime.setActiveDraft(activeSessionId, event.currentTarget.value);
          const result = runtime.finishEditing(activeSessionId, 'blur');
          if (result.status === 'blocked') {
            queueMicrotask(() => inputRef.current?.focus({ preventScroll: true }));
          }
        }}
        className={DATA_TABLE_INPUT_CLASS_NAME}
      />
    </DataTableEditorKeyboardShell>
  );
}

export function DataTableEditableInputCell<TData, TValue>({
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
  if (!config || !('editor' in config) || config.editor !== 'input') return null;

  const value = context.getValue();
  const activeCell = runtime?.activeCell;
  const readyCell = runtime?.readyCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;
  const isReady = readyCell?.rowId === context.row.id && readyCell.columnId === context.column.id;

  if (isActive && runtime) {
    return <InputEditor config={config} runtime={runtime} />;
  }

  return (
    <>
      <div data-slot='data-table-input-display'>
        {renderDataTableTextCell(formattedValue ?? value, className)}
      </div>
      {runtime && isReady ? (
        <div
          data-row-expand-ignore
          data-slot='data-table-input-editor-ready'
          className='absolute inset-0 hidden min-w-0 bg-background'
        >
          <Button
            data-slot='data-table-input-editor-ready-trigger'
            type='button'
            variant='outline'
            tabIndex={-1}
            aria-label={`准备编辑${config.title}`}
            onFocus={() => activateInputEditor(context, config, runtime, value)}
            onClick={() => activateInputEditor(context, config, runtime, value)}
            className={cn(DATA_TABLE_INPUT_CLASS_NAME, 'w-full justify-start font-normal')}
          >
            <span className='min-w-0 truncate'>
              {value == null || value === '' ? '-' : String(value)}
            </span>
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function DataTableEditableSwitchCell<TData, TValue>({
  context,
  className
}: {
  context: CellContext<TData, TValue>;
  className?: string;
}) {
  const config = context.column.columnDef.meta?.editableCell;
  const runtime = context.table.options.meta?.dataTableEditing;
  if (!config || !('editor' in config) || config.editor !== 'switch') return null;

  const switchConfig: DataTableEditableSwitchColumnMeta<TData> = config;
  const value = context.getValue();
  const checked = Object.is(value, switchConfig.checkedValue);
  const knownValue = checked || Object.is(value, switchConfig.uncheckedValue);
  const label = checked
    ? switchConfig.checkedLabel
    : knownValue
      ? switchConfig.uncheckedLabel
      : '-';
  const editable =
    runtime?.isCellEditable({
      rowId: context.row.id,
      row: context.row.original,
      columnId: context.column.id
    }) ?? false;

  return (
    <div
      data-row-expand-ignore
      data-slot='data-table-switch-cell'
      className={cn('flex min-w-0 items-center justify-center gap-2', className)}
    >
      <Switch
        checked={checked}
        disabled={!editable}
        aria-label={`${switchConfig.title}：${label}`}
        onCheckedChange={(nextChecked) => {
          if (!runtime) return;
          runtime.commitCandidate(
            {
              rowId: context.row.id,
              row: context.row.original,
              columnId: context.column.id,
              field: switchConfig.field,
              value: nextChecked ? switchConfig.checkedValue : switchConfig.uncheckedValue,
              editableCell: switchConfig
            },
            'selection'
          );
        }}
      />
      <span className='min-w-0 truncate text-sm'>{label}</span>
    </div>
  );
}
