import type { CellContext } from '@tanstack/react-table';
import * as React from 'react';

import { ButtonGroup } from '@/components/ui/button-group';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group';
import { DataTableEditorKeyboardShell } from '@/components/data-table/editing/cells/data-table-editor-keyboard-shell';
import { renderDataTableTextCell } from '@/components/data-table/cells/data-table-text-cell';
import { cn } from '@/lib/utils';
import type {
  DataTableActiveEditingCell,
  DataTableEditableNumberColumnMeta,
  DataTableEditingRuntime
} from '@/types/data-table';

function getDecimalPlaces(value: number) {
  const text = String(value).toLowerCase();
  const [coefficient, exponentText] = text.split('e');
  const fractionDigits = coefficient?.split('.')[1]?.length ?? 0;
  return Math.max(0, fractionDigits - Number(exponentText ?? 0));
}

function addNumericStep(value: number, step: number, direction: 1 | -1) {
  const precision = Math.min(12, Math.max(getDecimalPlaces(value), getDecimalPlaces(step)));
  const scale = 10 ** precision;
  return Math.round((value + direction * step) * scale) / scale;
}

function resolveSteppedValue<TData>(
  activeCell: DataTableActiveEditingCell<TData>,
  config: DataTableEditableNumberColumnMeta<TData>,
  direction: 1 | -1
) {
  if (
    config.preventStepping ||
    config.step === 'any' ||
    activeCell.parseState !== 'valid' ||
    typeof activeCell.candidateValue !== 'number'
  ) {
    return null;
  }

  const currentValue = activeCell.candidateValue;
  let nextValue = addNumericStep(currentValue, config.step, direction);
  if (config.min !== undefined) nextValue = Math.max(config.min, nextValue);
  if (config.max !== undefined) nextValue = Math.min(config.max, nextValue);
  return Object.is(currentValue, nextValue) ? null : nextValue;
}

function NumberEditor<TData>({
  config,
  runtime
}: {
  config: DataTableEditableNumberColumnMeta<TData>;
  runtime: DataTableEditingRuntime<TData>;
}) {
  const activeCell = runtime.activeCell;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const errorId = React.useId();

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const caretPosition = input.value.length;
    input.setSelectionRange(caretPosition, caretPosition);
  }, []);

  if (!activeCell) return null;
  const { sessionId, draftValue } = activeCell;
  const textValue = typeof draftValue === 'string' ? draftValue : String(draftValue ?? '');
  const isInvalid = activeCell.parseState === 'invalid';
  const decrementValue = resolveSteppedValue(activeCell, config, -1);
  const incrementValue = resolveSteppedValue(activeCell, config, 1);

  const applyStep = (nextValue: number | null) => {
    if (nextValue === null) return;
    runtime.setActiveDraft(sessionId, config.codec.formatForEdit(nextValue, activeCell.row));
  };

  return (
    <DataTableEditorKeyboardShell
      runtime={runtime}
      sessionId={sessionId}
      profile='numeric'
      slot='data-table-number-editor'
    >
      <InputGroup
        className={cn(
          'h-full rounded-[2px] border-2 border-primary bg-background shadow-none ring-[3px] ring-primary/25',
          isInvalid && 'border-destructive ring-destructive/20'
        )}
      >
        {config.prefix ? (
          <InputGroupAddon aria-hidden='true'>
            <InputGroupText>{config.prefix}</InputGroupText>
          </InputGroupAddon>
        ) : null}
        <InputGroupInput
          ref={inputRef}
          aria-label={`编辑${config.title}`}
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? errorId : undefined}
          type='text'
          inputMode='decimal'
          autoComplete='off'
          spellCheck={false}
          value={textValue}
          onChange={(event) => runtime.setActiveDraft(sessionId, event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || config.preventStepping) return;
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            if (config.step === 'any') return;
            event.preventDefault();
            event.stopPropagation();
            applyStep(event.key === 'ArrowUp' ? incrementValue : decrementValue);
          }}
          onBlur={(event) => {
            runtime.setActiveDraft(sessionId, event.currentTarget.value);
            const result = runtime.finishEditing(sessionId, 'blur');
            if (result.status === 'blocked') {
              queueMicrotask(() => inputRef.current?.focus({ preventScroll: true }));
            }
          }}
          className='h-full min-h-10 px-3 text-right tabular-nums'
        />
        {config.suffix ? (
          <InputGroupAddon align='inline-end' aria-hidden='true'>
            <InputGroupText>{config.suffix}</InputGroupText>
          </InputGroupAddon>
        ) : null}
        {config.showStepperButtons && config.step !== 'any' ? (
          <InputGroupAddon align='inline-end' className='h-full py-0 pr-1'>
            <ButtonGroup
              orientation='vertical'
              aria-label={`${config.title}步进控件`}
              className='h-full'
            >
              <InputGroupButton
                size='icon-xs'
                aria-label={`增加${config.title}`}
                className='h-1/2 min-h-0 w-6 rounded-[2px] px-0 leading-none'
                disabled={incrementValue === null}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyStep(incrementValue)}
              >
                +
              </InputGroupButton>
              <InputGroupButton
                size='icon-xs'
                aria-label={`减少${config.title}`}
                className='h-1/2 min-h-0 w-6 rounded-[2px] px-0 leading-none'
                disabled={decrementValue === null}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyStep(decrementValue)}
              >
                −
              </InputGroupButton>
            </ButtonGroup>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      {isInvalid ? (
        <span id={errorId} role='alert' className='sr-only'>
          {activeCell.validationErrors[0]}
        </span>
      ) : null}
    </DataTableEditorKeyboardShell>
  );
}

export function DataTableEditableNumberCell<TData, TValue>({
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
  if (!config || config.editor !== 'number') return null;

  const value = context.getValue();
  const activeCell = runtime?.activeCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;

  if (isActive && runtime) {
    return <NumberEditor config={config} runtime={runtime} />;
  }

  return (
    <div data-slot='data-table-number-display' className='min-w-0 truncate tabular-nums'>
      {renderDataTableTextCell(formattedValue ?? value, className)}
    </div>
  );
}
