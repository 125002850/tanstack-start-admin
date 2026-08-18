import type { CellContext } from '@tanstack/react-table';
import { zhCN } from 'date-fns/locale';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { DataTableEditorKeyboardShell } from '@/components/data-table/editing/cells/data-table-editor-keyboard-shell';
import { DATA_TABLE_TEMPORAL_CALENDAR_CLASS_NAMES } from '@/components/data-table/editing/cells/data-table-temporal-calendar-layout';
import {
  dataTableDateValueToLocalDate,
  localDateToDataTableDateValue,
  parseDataTableDateValue
} from '@/components/data-table/editing/codecs/data-table-date-edit-codec';
import { renderDataTableTextCell } from '@/components/data-table/cells/data-table-text-cell';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import type {
  DataTableEditableDateColumnMeta,
  DataTableEditingRuntime,
  DataTableFinishEditingResult
} from '../types';

function shouldRestoreDateCellFocus(result: DataTableFinishEditingResult) {
  return (
    result.status === 'committed' || result.status === 'unchanged' || result.status === 'reverted'
  );
}

function focusConnectedDateCell(cell: HTMLTableCellElement | null) {
  if (!cell?.isConnected) return;
  queueMicrotask(() => {
    if (cell.isConnected) cell.focus({ preventScroll: true });
  });
}

function DateEditor<TData>({
  config,
  runtime
}: {
  config: DataTableEditableDateColumnMeta<TData>;
  runtime: DataTableEditingRuntime<TData>;
}) {
  const activeCell = runtime.activeCell;
  const [open, setOpen] = React.useState(true);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>();
  const ownerCellRef = React.useRef<HTMLTableCellElement | null>(null);
  const errorId = React.useId();
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const sessionId = activeCell?.sessionId;

  const setCalendarTriggerNode = React.useCallback(
    (node: HTMLButtonElement | null) => {
      setTriggerNode(node);
      if (node) ownerCellRef.current = node.closest('td');
    },
    [setTriggerNode]
  );

  if (!activeCell || sessionId === undefined) return null;
  const draftValue =
    typeof activeCell.draftValue === 'string'
      ? activeCell.draftValue
      : String(activeCell.draftValue ?? '');
  const parsedDraft = parseDataTableDateValue(draftValue);
  const selectedDate = parsedDraft ? dataTableDateValueToLocalDate(parsedDraft.value) : undefined;
  const isInvalid = activeCell.parseState === 'invalid';
  const portalContainer = open ? (container ?? getContainer()) : container;

  const cancel = () => {
    setOpen(false);
    runtime.cancelEditing(sessionId);
    focusConnectedDateCell(ownerCellRef.current);
  };

  const finishSelection = (nextDraft: string) => {
    runtime.setActiveDraft(sessionId, nextDraft);
    const result = runtime.finishEditing(sessionId, 'selection');
    if (shouldRestoreDateCellFocus(result)) {
      setOpen(false);
      focusConnectedDateCell(ownerCellRef.current);
    }
  };

  return (
    <DataTableEditorKeyboardShell
      runtime={runtime}
      sessionId={sessionId}
      profile='choice'
      slot='data-table-date-editor'
      onAnchorDetach={() => setOpen(false)}
    >
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setCalendarMonth(selectedDate ?? new Date());
          } else if (runtime.activeCell?.sessionId === sessionId) {
            runtime.cancelEditing(sessionId);
            focusConnectedDateCell(ownerCellRef.current);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            ref={setCalendarTriggerNode}
            type='button'
            variant='outline'
            tabIndex={-1}
            aria-label={`编辑${config.title}`}
            aria-invalid={isInvalid}
            aria-describedby={isInvalid ? errorId : undefined}
            className='h-full w-full min-w-0 justify-between rounded-[2px] border-2 border-primary bg-background px-3 font-normal shadow-none ring-[3px] ring-primary/25'
          >
            <span className='min-w-0 truncate font-mono'>{draftValue || '-'}</span>
            <Icons.calendar className='size-4 shrink-0' />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          role='dialog'
          aria-modal='false'
          aria-label={`${config.title}日历`}
          align='start'
          container={portalContainer}
          finalFocus={triggerRef}
          className='w-[min(20rem,calc(100vw-2rem))] p-0'
          data-row-expand-ignore
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            cancel();
          }}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onWheelCapture={(event) => event.stopPropagation()}
        >
          <Calendar
            mode='single'
            locale={zhCN}
            className='w-full'
            classNames={DATA_TABLE_TEMPORAL_CALENDAR_CLASS_NAMES}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- DayPicker uses this to establish its documented roving tabindex target after an explicit open action.
            autoFocus
            month={calendarMonth ?? selectedDate ?? new Date()}
            onMonthChange={setCalendarMonth}
            selected={selectedDate}
            disabled={(date) =>
              config.codec.validate(localDateToDataTableDateValue(date), activeCell.row).length > 0
            }
            onSelect={(date) => {
              if (date) finishSelection(localDateToDataTableDateValue(date));
            }}
          />
          {isInvalid ? (
            <p id={errorId} role='alert' className='px-3 pb-2 text-xs text-destructive'>
              {activeCell.validationErrors[0]}
            </p>
          ) : null}
          {config.allowEmpty && draftValue !== '' ? (
            <>
              <Separator />
              <div className='flex justify-end p-2'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  aria-label={`清除${config.title}`}
                  onClick={() => finishSelection('')}
                >
                  清除
                </Button>
              </div>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    </DataTableEditorKeyboardShell>
  );
}

export function DataTableEditableDateCell<TData, TValue>({
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
  if (!config || config.editor !== 'date') return null;

  const value = context.getValue();
  const activeCell = runtime?.activeCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;

  if (isActive && runtime) {
    return <DateEditor config={config} runtime={runtime} />;
  }

  return (
    <div data-slot='data-table-date-display' className='min-w-0 truncate tabular-nums'>
      {renderDataTableTextCell(formattedValue ?? value, className)}
    </div>
  );
}
