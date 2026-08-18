import { createChoiceAdapter } from '@/components/data-table/editing/adapters/data-table-choice-edit-adapter';
import { dateAdapter } from '@/components/data-table/editing/adapters/data-table-date-edit-adapter';
import { dateTimeAdapter } from '@/components/data-table/editing/adapters/data-table-date-time-edit-adapter';
import { createNumericAdapter } from '@/components/data-table/editing/adapters/data-table-numeric-edit-adapter';
import {
  longTextAdapter,
  textAdapter
} from '@/components/data-table/editing/adapters/data-table-text-edit-adapter';
import type {
  EnabledEditableTypeAdapterRegistry,
  ResolveDataTableEditableCellContext,
  ResolvedEditableCellMeta,
  ResolvedDataTableEditableCell
} from '@/components/data-table/editing/contracts';
import type { DataTableEditCodec, PlannedEditableType } from './types';

export type {
  ResolveDataTableEditableCellContext,
  ResolvedDataTableEditableCell
} from '@/components/data-table/editing/contracts';
export { percentPoints } from '@/components/data-table/editing/codecs/data-table-numeric-edit-codec';

export const enabledEditableTypeAdapters = {
  text: textAdapter,
  enum: createChoiceAdapter('enum'),
  select: createChoiceAdapter('select'),
  remoteSelect: createChoiceAdapter('remoteSelect'),
  longText: longTextAdapter,
  number: createNumericAdapter('number'),
  int: createNumericAdapter('int'),
  decimal: createNumericAdapter('decimal'),
  money: createNumericAdapter('money'),
  percent: createNumericAdapter('percent'),
  date: dateAdapter,
  dateTime: dateTimeAdapter
} as const satisfies Record<PlannedEditableType, typeof textAdapter>;

export type SupportedEditableType = keyof typeof enabledEditableTypeAdapters;

export const PLANNED_EDITABLE_TYPES = Object.keys(
  enabledEditableTypeAdapters
) as readonly SupportedEditableType[];

export function resolveDataTableEditableCell<TData>(
  context: ResolveDataTableEditableCellContext<TData>,
  registry: EnabledEditableTypeAdapterRegistry<SupportedEditableType> = enabledEditableTypeAdapters
): ResolvedDataTableEditableCell<TData> | null {
  const adapter = registry[context.type as SupportedEditableType];
  if (!adapter) return null;
  const resolvedColumnMeta = adapter.resolve(context);
  if (!resolvedColumnMeta) return null;
  const codec = resolvedColumnMeta.editableCell.codec as DataTableEditCodec<TData, unknown>;
  const publicColumnMeta = resolvedColumnMeta as ResolvedEditableCellMeta<TData>;
  const columnMeta = publicColumnMeta.copyValue
    ? publicColumnMeta
    : {
        ...publicColumnMeta,
        copyValue: (value: unknown, row: TData) => codec.formatForEdit(value, row)
      };

  return {
    columnMeta,
    renderCell: adapter.renderCell,
    resolveFormattedValue: (formatterContext) =>
      adapter.resolveFormattedValue({
        ...formatterContext,
        editableCell: columnMeta.editableCell
      })
  };
}
