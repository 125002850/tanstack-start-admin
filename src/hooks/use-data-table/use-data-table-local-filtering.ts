import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';

import type {
  DataTableLocalColumnFilter,
  DataTableLocalFilterMeta,
  DataTableLocalFilterOption,
  DataTableLocalFilteringRuntime,
  DataTableLocalSetFilterValue
} from '@/types/data-table';

interface DataTableLocalFilterColumn<TData> {
  id: string;
  meta: DataTableLocalFilterMeta<TData>;
  getValue: (row: TData, index: number) => unknown;
}

interface LocalFilterCandidate extends DataTableLocalFilterOption {
  rawValue: unknown;
  configuredOrder?: number;
}

interface UseDataTableLocalFilteringOptions<TData> {
  data: TData[];
  columns: readonly ColumnDef<TData>[];
  resetScope: string;
}

const EMPTY_LOCAL_FILTERS: DataTableLocalColumnFilter[] = [];
const EMPTY_LOCAL_FILTER_OPTIONS: DataTableLocalFilterOption[] = [];
const LOCAL_FILTER_BLANK_KEY = 'blank:';
const localFilterCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base'
});

function isBlankLocalFilterValue(value: unknown) {
  return value === null || value === undefined || (typeof value === 'string' && value.length === 0);
}

/** 将原始值转换成可持久比较的 typed key，避免字符串 1 与数字 1 混为一项。 */
export function getDataTableLocalFilterValueKey(value: unknown): string {
  if (isBlankLocalFilterValue(value)) return LOCAL_FILTER_BLANK_KEY;
  if (value instanceof Date) return `date:${value.getTime()}`;

  switch (typeof value) {
    case 'string':
      return `string:${value}`;
    case 'number':
      return `number:${Object.is(value, -0) ? '-0' : String(value)}`;
    case 'boolean':
      return `boolean:${value ? '1' : '0'}`;
    case 'bigint':
      return `bigint:${String(value)}`;
    default: {
      try {
        return `json:${JSON.stringify(value)}`;
      } catch {
        return `${typeof value}:${String(value)}`;
      }
    }
  }
}

/** 构造 Set Filter 状态；空数组是有效条件，表示不匹配任何行。 */
export function createDataTableLocalSetFilterValue(
  selectedKeys: Iterable<string>
): DataTableLocalSetFilterValue {
  return { kind: 'set', selectedKeys: [...new Set(selectedKeys)] };
}

function getColumnId<TData>(column: ColumnDef<TData>) {
  if (typeof column.id === 'string') return column.id;
  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey.replaceAll('.', '_');
  }
  return undefined;
}

function getValueByPath(row: unknown, path: string) {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[segment];
  }, row);
}

function collectLocalFilterColumns<TData>(columns: readonly ColumnDef<TData>[]) {
  const result = new Map<string, DataTableLocalFilterColumn<TData>>();

  const visit = (column: ColumnDef<TData>) => {
    if ('columns' in column && Array.isArray(column.columns)) {
      column.columns.forEach(visit);
      return;
    }

    const id = getColumnId(column);
    const meta = column.meta?.localFilter;
    if (!id || !meta) return;

    if ('accessorFn' in column && typeof column.accessorFn === 'function') {
      result.set(id, {
        id,
        meta,
        getValue: (row, index) => column.accessorFn?.(row, index)
      });
      return;
    }

    if ('accessorKey' in column && typeof column.accessorKey === 'string') {
      result.set(id, {
        id,
        meta,
        getValue: (row) => getValueByPath(row, column.accessorKey as string)
      });
    }
  };

  columns.forEach(visit);
  return result;
}

function getLocalFilterValues(value: unknown) {
  if (!Array.isArray(value)) return [value];
  return value.length > 0 ? value : [undefined];
}

function getFormattedText(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map(getFormattedText).filter((part): part is string => part !== undefined);
    return parts.length > 0 ? parts.join('、') : undefined;
  }
  return undefined;
}

function formatLocalFilterValue<TData>(
  column: DataTableLocalFilterColumn<TData>,
  value: unknown,
  row: TData
) {
  if (isBlankLocalFilterValue(value)) return '（空白）';

  const configuredLabel = column.meta.options?.find(
    (option) => option.value === String(value)
  )?.label;
  if (configuredLabel) return configuredLabel;

  const formattedText = getFormattedText(column.meta.formatValue?.(value, row));
  if (formattedText) return formattedText;

  if (column.meta.variant === 'boolean') {
    if (value === true || value === '1') return '是';
    if (value === false || value === '0') return '否';
  }
  return String(value);
}

function filterRowsWithColumns<TData>(
  data: TData[],
  filterColumns: ReadonlyMap<string, DataTableLocalFilterColumn<TData>>,
  filters: readonly DataTableLocalColumnFilter[],
  excludedColumnId?: string
) {
  const compiledFilters = filters.flatMap((filter) => {
    if (filter.id === excludedColumnId) return [];
    const column = filterColumns.get(filter.id);
    return column ? [{ column, selectedKeys: new Set(filter.value.selectedKeys) }] : [];
  });
  if (compiledFilters.length === 0) return data;

  return data.filter((row, rowIndex) =>
    compiledFilters.every(({ column, selectedKeys }) =>
      getLocalFilterValues(column.getValue(row, rowIndex)).some((value) =>
        selectedKeys.has(getDataTableLocalFilterValueKey(value))
      )
    )
  );
}

function compareLocalFilterCandidates(left: LocalFilterCandidate, right: LocalFilterCandidate) {
  if (left.configuredOrder !== right.configuredOrder) {
    if (left.configuredOrder === undefined) return 1;
    if (right.configuredOrder === undefined) return -1;
    return left.configuredOrder - right.configuredOrder;
  }
  if (left.key === LOCAL_FILTER_BLANK_KEY) return 1;
  if (right.key === LOCAL_FILTER_BLANK_KEY) return -1;
  if (typeof left.rawValue === 'number' && typeof right.rawValue === 'number') {
    return left.rawValue - right.rawValue;
  }
  return localFilterCollator.compare(left.label, right.label);
}

function collectColumnFilterOptions<TData>(
  data: TData[],
  filterColumns: ReadonlyMap<string, DataTableLocalFilterColumn<TData>>,
  filters: readonly DataTableLocalColumnFilter[],
  columnId: string
) {
  const column = filterColumns.get(columnId);
  if (!column) return EMPTY_LOCAL_FILTER_OPTIONS;

  const availableRows = filterRowsWithColumns(data, filterColumns, filters, column.id);
  const configuredOrder = new Map(
    column.meta.options?.map((option, index) => [option.value, index]) ?? []
  );
  const candidates = new Map<string, LocalFilterCandidate>();

  availableRows.forEach((row, rowIndex) => {
    getLocalFilterValues(column.getValue(row, rowIndex)).forEach((rawValue) => {
      const key = getDataTableLocalFilterValueKey(rawValue);
      if (candidates.has(key)) return;
      candidates.set(key, {
        key,
        label: formatLocalFilterValue(column, rawValue, row),
        rawValue,
        configuredOrder: configuredOrder.get(String(rawValue))
      });
    });
  });

  return [...candidates.values()]
    .toSorted(compareLocalFilterCandidates)
    .map(({ key, label }) => ({ key, label }));
}

/** 对当前已加载数据执行本地 Set Filter AND 筛选；未知或已移除的列条件会被忽略。 */
export function filterDataTableRows<TData>(
  data: TData[],
  columns: readonly ColumnDef<TData>[],
  filters: readonly DataTableLocalColumnFilter[]
) {
  if (filters.length === 0) return data;
  return filterRowsWithColumns(data, collectLocalFilterColumns(columns), filters);
}

/** 管理与服务端 columnFilters 隔离的表头本地 Set Filter 状态。 */
export function useDataTableLocalFiltering<TData>({
  data,
  columns,
  resetScope
}: UseDataTableLocalFilteringOptions<TData>) {
  const [snapshot, setSnapshot] = React.useState<{
    scope: string;
    filters: DataTableLocalColumnFilter[];
  }>({ scope: resetScope, filters: [] });

  const filters = snapshot.scope === resetScope ? snapshot.filters : EMPTY_LOCAL_FILTERS;

  React.useLayoutEffect(() => {
    setSnapshot((current) =>
      current.scope === resetScope ? current : { scope: resetScope, filters: [] }
    );
  }, [resetScope]);

  const setFilterValue = React.useCallback(
    (columnId: string, value: DataTableLocalSetFilterValue | undefined) => {
      setSnapshot((current) => {
        const currentFilters = current.scope === resetScope ? current.filters : [];
        const remainingFilters = currentFilters.filter((filter) => filter.id !== columnId);

        return {
          scope: resetScope,
          filters: value
            ? [
                ...remainingFilters,
                { id: columnId, value: createDataTableLocalSetFilterValue(value.selectedKeys) }
              ]
            : remainingFilters
        };
      });
    },
    [resetScope]
  );

  const reset = React.useCallback(() => {
    setSnapshot({ scope: resetScope, filters: [] });
  }, [resetScope]);

  const filterColumns = React.useMemo(() => collectLocalFilterColumns(columns), [columns]);
  const getFilterOptions = React.useMemo(() => {
    const cache = new Map<string, readonly DataTableLocalFilterOption[]>();

    return (columnId: string) => {
      const cached = cache.get(columnId);
      if (cached) return cached;
      const options = collectColumnFilterOptions(data, filterColumns, filters, columnId);
      cache.set(columnId, options);
      return options;
    };
  }, [data, filterColumns, filters]);
  const filteredData = React.useMemo(
    () => filterRowsWithColumns(data, filterColumns, filters),
    [data, filterColumns, filters]
  );

  const runtime = React.useMemo<DataTableLocalFilteringRuntime>(
    () => ({
      filters,
      getFilterOptions,
      getFilterValue: (columnId) => filters.find((filter) => filter.id === columnId)?.value,
      setFilterValue,
      reset
    }),
    [filters, getFilterOptions, reset, setFilterValue]
  );

  return { data: filteredData, runtime };
}
