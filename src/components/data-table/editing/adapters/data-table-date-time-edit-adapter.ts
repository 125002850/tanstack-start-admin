import { createElement } from 'react';

import { DataTableEditableDateTimeCell } from '@/components/data-table/editing/cells/data-table-editable-date-time-cell';
import type {
  AdapterResolvedEditableCellMeta,
  EditableCellRendererContext,
  EditableDisplayFormatterContext,
  EnabledEditableTypeAdapter,
  ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-contracts';
import { createDateTimeEditCodec } from '@/components/data-table/editing/codecs/data-table-date-time-edit-codec';
import { resolveDataTableTimeZone } from '@/components/data-table/editing/data-table-time-zone';
import type {
  DataTableDateTimeGranularity,
  DataTableDateTimeValueKind,
  DataTableEditableDateTimeColumnMeta,
  DataTableInvalidEditBehavior,
  DataTableTimeZoneSource
} from '@/types/data-table';

type ResolvedDateTimeEditOptions = {
  valueKind: DataTableDateTimeValueKind;
  timeZone?: string;
  timeZoneSource?: DataTableTimeZoneSource;
  granularity: DataTableDateTimeGranularity;
  step: number;
  hourCycle: 12 | 24;
  defaultTime: 'now' | string;
  min?: string;
  max?: string;
  allowEmpty: boolean;
  emptyValue: null;
  invalidEditBehavior: DataTableInvalidEditBehavior;
};

function normalizeDateTimeDefaultTime(
  value: string | undefined,
  granularity: DataTableDateTimeGranularity
) {
  if (value === 'now') return value;
  const fallback = granularity === 'second' ? '00:00:00' : '00:00';
  if (value === undefined || value === '00:00') return fallback;
  const pattern = granularity === 'second' ? /^\d{2}:\d{2}(?::\d{2})?$/ : /^\d{2}:\d{2}$/;
  if (!pattern.test(value)) {
    throw new Error(`DataTable editable dateTime defaultTime must match ${fallback}.`);
  }
  const normalized = granularity === 'second' && value.length === 5 ? `${value}:00` : value;
  const [hour, minute, second = '0'] = normalized.split(':');
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error(`DataTable editable dateTime defaultTime must match ${fallback}.`);
  }
  return normalized;
}

function resolveDateTimeEditOptions<TData>(
  context: ResolveDataTableEditableCellContext<TData>
): ResolvedDateTimeEditOptions | null {
  const edit = context.edit;
  if (edit?.valueKind !== 'instant' && edit?.valueKind !== 'local') {
    throw new Error('DataTable editable dateTime requires valueKind "instant" or "local".');
  }
  const granularity = edit.granularity ?? 'minute';
  const step = edit.step ?? 1;
  if (typeof step !== 'number' || !Number.isInteger(step) || step <= 0) {
    throw new Error('DataTable editable dateTime step must be a positive integer.');
  }
  const hourCycle = edit.hourCycle ?? 24;
  if (hourCycle !== 12 && hourCycle !== 24) {
    throw new Error('DataTable editable dateTime hourCycle must be 12 or 24.');
  }
  if (edit.valueKind === 'local' && edit.timeZone !== undefined) {
    throw new Error('DataTable local dateTime must not configure a time zone.');
  }

  let timeZone: string | undefined;
  let timeZoneSource: DataTableTimeZoneSource | undefined;
  if (edit.valueKind === 'instant') {
    try {
      const resolved = resolveDataTableTimeZone({
        columnTimeZone: edit.timeZone,
        tableTimeZone: context.tableTimeZone,
        appTimeZone: context.appTimeZone,
        tableId: context.tableId,
        columnId: context.field
      });
      timeZone = resolved.timeZone;
      timeZoneSource = resolved.source;
    } catch (error) {
      if (!import.meta.env.PROD) throw error;
      console.error(error);
      return null;
    }
  }

  return {
    valueKind: edit.valueKind,
    timeZone,
    timeZoneSource,
    granularity,
    step,
    hourCycle,
    defaultTime: normalizeDateTimeDefaultTime(edit.defaultTime, granularity),
    min: typeof edit.min === 'string' ? edit.min : undefined,
    max: typeof edit.max === 'string' ? edit.max : undefined,
    allowEmpty: edit.allowEmpty ?? true,
    emptyValue: null,
    invalidEditBehavior: edit.invalidEditBehavior ?? 'block'
  };
}

export const dateTimeAdapter: EnabledEditableTypeAdapter = {
  editor: 'dateTime',
  resolve: <TData>(
    context: ResolveDataTableEditableCellContext<TData>
  ): AdapterResolvedEditableCellMeta<TData> | null => {
    const edit = resolveDateTimeEditOptions(context);
    if (!edit) return null;
    const codec = createDateTimeEditCodec<TData>(edit);
    const editableCell: DataTableEditableDateTimeColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'dateTime',
      editor: 'dateTime',
      codec,
      commitMode: 'explicit-confirm',
      ...edit
    };
    return {
      editableCell,
      copyValue: (value, row) => (value == null ? '' : codec.formatForEdit(value as string, row))
    };
  },
  renderCell: <TData>({ context, formattedValue, className }: EditableCellRendererContext<TData>) =>
    createElement(DataTableEditableDateTimeCell<TData, unknown>, {
      context,
      formattedValue,
      className
    }),
  resolveFormattedValue: <TData>({
    value,
    row,
    editableCell,
    columnFormatter,
    fallbackFormatter
  }: EditableDisplayFormatterContext<TData>) => {
    if (columnFormatter) return columnFormatter(value, row);
    if (editableCell?.editor !== 'dateTime') return fallbackFormatter();
    return editableCell.codec.formatForEdit(value as string | null, row) as unknown;
  }
};
