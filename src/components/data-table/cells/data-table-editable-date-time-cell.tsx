import type { CellContext } from '@tanstack/react-table';
import { zhCN } from 'date-fns/locale';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { DataTableEditorKeyboardShell } from '@/components/data-table/cells/data-table-editor-keyboard-shell';
import { DATA_TABLE_TEMPORAL_CALENDAR_CLASS_NAMES } from '@/components/data-table/cells/data-table-temporal-calendar-layout';
import {
  dataTableDateValueToLocalDate,
  formatDataTableDateTimeDraftValue,
  formatDataTableLocalDateTimeValue,
  localDateToDataTableDateValue,
  parseDataTableDateTimeDraftValue
} from '@/components/data-table/columns/data-table-edit-codecs';
import { renderDataTableTextCell } from '@/components/data-table/columns/data-table-column-rendering';
import { formatDataTableInstantInTimeZone } from '@/components/data-table/columns/data-table-time-zone';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type {
  DataTableEditableDateTimeColumnMeta,
  DataTableEditingRuntime,
  DataTableFinishEditingResult
} from '@/types/data-table';

function shouldRestoreDateTimeCellFocus(result: DataTableFinishEditingResult) {
  return (
    result.status === 'committed' || result.status === 'unchanged' || result.status === 'reverted'
  );
}

function focusConnectedDateTimeCell(cell: HTMLTableCellElement | null) {
  if (!cell?.isConnected) return;
  queueMicrotask(() => {
    if (cell.isConnected) cell.focus({ preventScroll: true });
  });
}

function getCurrentDateTimeParts<TData>(config: DataTableEditableDateTimeColumnMeta<TData>) {
  if (config.valueKind === 'instant' && config.timeZone) {
    return formatDataTableInstantInTimeZone(Date.now(), config.timeZone);
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds()
  };
}

function resolveDefaultTime<TData>(config: DataTableEditableDateTimeColumnMeta<TData>) {
  if (config.defaultTime !== 'now') return config.defaultTime;
  const parts = getCurrentDateTimeParts(config);
  const value = formatDataTableLocalDateTimeValue(parts, config.granularity);
  return value.slice(value.indexOf('T') + 1);
}

function DateTimeEditor<TData>({
  config,
  runtime
}: {
  config: DataTableEditableDateTimeColumnMeta<TData>;
  runtime: DataTableEditingRuntime<TData>;
}) {
  const activeCell = runtime.activeCell;
  const [open, setOpen] = React.useState(true);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>();
  const timeInputRef = React.useRef<HTMLInputElement>(null);
  const ownerCellRef = React.useRef<HTMLTableCellElement | null>(null);
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const errorId = React.useId();
  const timeInputId = React.useId();
  const sessionId = activeCell?.sessionId;

  const setAnchorNode = React.useCallback(
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
  const parsedDraft = parseDataTableDateTimeDraftValue(draftValue, config.granularity);
  const currentParts = getCurrentDateTimeParts(config);
  const selectedDate = parsedDraft
    ? dataTableDateValueToLocalDate(
        parsedDraft.value.slice(0, 10) as `${number}-${number}-${number}`
      )
    : undefined;
  const resolvedCalendarMonth =
    calendarMonth ??
    selectedDate ??
    dataTableDateValueToLocalDate(
      `${String(currentParts.year).padStart(4, '0')}-${String(currentParts.month).padStart(2, '0')}-${String(currentParts.day).padStart(2, '0')}` as `${number}-${number}-${number}`
    );
  const timeValue =
    parsedDraft?.value.slice(11) ??
    (draftValue.match(/[ T](\d{2}:\d{2}(?::\d{2})?)/)?.[1] || resolveDefaultTime(config));
  const isInvalid = activeCell.parseState === 'invalid';
  const portalContainer = open ? (container ?? getContainer()) : container;

  const cancel = () => {
    setOpen(false);
    runtime.cancelEditing(sessionId);
    focusConnectedDateTimeCell(ownerCellRef.current);
  };

  const confirm = () => {
    const result = runtime.finishEditing(sessionId, 'enter');
    if (shouldRestoreDateTimeCellFocus(result)) {
      setOpen(false);
      focusConnectedDateTimeCell(ownerCellRef.current);
    } else {
      queueMicrotask(() => timeInputRef.current?.focus({ preventScroll: true }));
    }
  };

  const updateDateAndTime = (dateValue: string, time: string) => {
    const [hour = '00', minute = '00', second = '00'] = time.split(':');
    runtime.setActiveDraft(
      sessionId,
      formatDataTableDateTimeDraftValue({
        year: Number(dateValue.slice(0, 4)),
        month: Number(dateValue.slice(5, 7)),
        day: Number(dateValue.slice(8, 10)),
        hour: Number(hour),
        minute: Number(minute),
        second: config.granularity === 'second' ? Number(second) : 0
      })
    );
  };

  const isCalendarDateDisabled = (date: Date) => {
    const nextDraft = `${localDateToDataTableDateValue(date)}T${timeValue}`;
    const parsed = config.codec.parse(nextDraft, activeCell.row);
    return (
      parsed.status === 'invalid' ||
      (parsed.value !== null && config.codec.validate(parsed.value, activeCell.row).length > 0)
    );
  };

  return (
    <DataTableEditorKeyboardShell
      runtime={runtime}
      sessionId={sessionId}
      profile='choice'
      slot='data-table-date-time-editor'
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
            aria-label={`打开${config.title}日期时间编辑器`}
            className='h-full w-full min-w-0 justify-start rounded-[2px] border-2 border-primary bg-background px-[15px] font-normal shadow-none ring-[3px] ring-primary/25'
          >
            <span className='min-w-0 truncate font-mono'>{draftValue || '-'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          role='dialog'
          aria-modal='false'
          aria-label={`${config.title}日期时间编辑器`}
          align='start'
          container={portalContainer}
          finalFocus={triggerRef}
          className='max-h-[min(80vh,40rem)] w-[min(22rem,calc(100vw-2rem))] overflow-auto p-3'
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
            month={resolvedCalendarMonth}
            onMonthChange={setCalendarMonth}
            selected={selectedDate}
            disabled={isCalendarDateDisabled}
            onSelect={(date) => {
              if (date) updateDateAndTime(localDateToDataTableDateValue(date), timeValue);
            }}
            className='w-full p-0'
            classNames={DATA_TABLE_TEMPORAL_CALENDAR_CLASS_NAMES}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- DayPicker owns the documented roving tabindex target when the editor opens.
            autoFocus
          />
          <label htmlFor={timeInputId} className='mt-2 grid gap-1 text-sm'>
            <span>时间</span>
            <Input
              ref={timeInputRef}
              id={timeInputId}
              aria-label={`${config.title}：时间`}
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? errorId : undefined}
              type='time'
              step={config.step * (config.granularity === 'minute' ? 60 : 1)}
              value={timeValue}
              onChange={(event) => {
                const dateValue =
                  parsedDraft?.value.slice(0, 10) ??
                  localDateToDataTableDateValue(resolvedCalendarMonth ?? new Date());
                updateDateAndTime(dateValue, event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.stopPropagation();
                  confirm();
                }
              }}
            />
          </label>
          {isInvalid ? (
            <p id={errorId} role='alert' className='mt-1 text-xs text-destructive'>
              {activeCell.validationErrors[0]}
            </p>
          ) : null}
          <div className='mt-3 flex items-center justify-end gap-2'>
            {config.allowEmpty ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='mr-auto'
                onClick={() => runtime.setActiveDraft(sessionId, '')}
              >
                清除
              </Button>
            ) : null}
            <Button type='button' variant='outline' size='sm' onClick={cancel}>
              取消
            </Button>
            <Button type='button' size='sm' onClick={confirm}>
              确定
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </DataTableEditorKeyboardShell>
  );
}

export function DataTableEditableDateTimeCell<TData, TValue>({
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
  if (!config || config.editor !== 'dateTime') return null;

  const value = context.getValue();
  const activeCell = runtime?.activeCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;

  if (isActive && runtime) {
    return <DateTimeEditor config={config} runtime={runtime} />;
  }

  return (
    <div data-slot='data-table-date-time-display' className='min-w-0 truncate tabular-nums'>
      {renderDataTableTextCell(formattedValue ?? value, className)}
    </div>
  );
}
