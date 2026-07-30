import type { CellContext } from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { renderDataTableTextCell } from '@/components/ui/table/columns/data-table-column-rendering';
import { cn } from '@/lib/utils';
import type {
  DataTableEditableInputColumnMeta,
  DataTableEditableSwitchColumnMeta,
  DataTableEditingRuntime
} from '@/types/data-table';

const DATA_TABLE_INPUT_CLASS_NAME =
  'h-full min-h-10 rounded-[2px] border-2 border-primary bg-background px-[15px] shadow-none ring-[3px] ring-primary/25 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25';

function focusAdjacentEditableCell(cell: HTMLTableCellElement | null, backwards: boolean) {
  const table = cell?.closest('table');
  if (!cell || !table) return;
  const cells = [...table.querySelectorAll<HTMLTableCellElement>('td[data-cell-editable="true"]')];
  const currentIndex = cells.indexOf(cell);
  const nextIndex = backwards ? currentIndex - 1 : currentIndex + 1;
  cells[nextIndex]?.focus({ preventScroll: true });
}

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
    value
  });
}

function InputEditor<TData>({
  config,
  runtime
}: {
  config: DataTableEditableInputColumnMeta<TData>;
  runtime: DataTableEditingRuntime<TData>;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeCell = runtime.activeCell;
  const runtimeRef = React.useRef(runtime);
  runtimeRef.current = runtime;
  const sessionId = activeCell?.sessionId;

  React.useEffect(
    () => () => {
      if (sessionId === undefined) return;
      runtimeRef.current.finishEditing(sessionId, 'blur');
    },
    [sessionId]
  );

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
  const { sessionId: activeSessionId, value } = activeCell;

  return (
    <div
      ref={rootRef}
      data-row-expand-ignore
      data-slot='data-table-input-editor'
      className='absolute inset-0 min-w-0 bg-background'
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          const cell = rootRef.current?.closest<HTMLTableCellElement>(
            'td[data-cell-editable="true"]'
          );
          runtime.cancelEditing(activeSessionId);
          queueMicrotask(() => cell?.focus({ preventScroll: true }));
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          if (event.target instanceof HTMLInputElement) {
            runtime.setActiveValue(activeSessionId, event.target.value);
          }
          const cell = rootRef.current?.closest<HTMLTableCellElement>(
            'td[data-cell-editable="true"]'
          );
          runtime.finishEditing(activeSessionId, 'enter');
          queueMicrotask(() => cell?.focus({ preventScroll: true }));
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
          const cell = rootRef.current?.closest<HTMLTableCellElement>(
            'td[data-cell-editable="true"]'
          );
          if (event.target instanceof HTMLInputElement) {
            runtime.setActiveValue(activeSessionId, event.target.value);
          }
          runtime.finishEditing(activeSessionId, 'tab');
          queueMicrotask(() => focusAdjacentEditableCell(cell ?? null, event.shiftKey));
        }
      }}
    >
      <Input
        ref={inputRef}
        aria-label={`编辑${config.title}`}
        type={config.inputType}
        inputMode={config.inputMode}
        placeholder={config.placeholder}
        maxLength={config.maxLength}
        value={value == null ? '' : String(value)}
        onChange={(event) => runtime.setActiveValue(activeSessionId, event.currentTarget.value)}
        onBlur={(event) => {
          runtime.setActiveValue(activeSessionId, event.currentTarget.value);
          runtime.finishEditing(activeSessionId, 'blur');
        }}
        className={DATA_TABLE_INPUT_CLASS_NAME}
      />
    </div>
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
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;

  if (isActive && runtime) {
    return <InputEditor config={config} runtime={runtime} />;
  }

  return (
    <>
      <div data-slot='data-table-input-display'>
        {renderDataTableTextCell(formattedValue ?? value, className)}
      </div>
      {runtime ? (
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
          runtime.commitValue(
            {
              rowId: context.row.id,
              row: context.row.original,
              columnId: context.column.id,
              field: switchConfig.field,
              value: nextChecked ? switchConfig.checkedValue : switchConfig.uncheckedValue
            },
            'selection'
          );
        }}
      />
      <span className='min-w-0 truncate text-sm'>{label}</span>
    </div>
  );
}
