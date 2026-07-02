import { env } from './env';
import type {
  DataTableResolvedVirtualizationOptions,
  DataTableVirtualizationFallbackReason,
  DataTableVirtualizationOptions,
  DataTableVirtualizationProp
} from '@/types/data-table';

export type DataTableConfig = typeof dataTableConfig;

// ── Virtual scroll shared preset ──────────────────────────────────────

export const DATA_TABLE_VIRTUAL_PRESET = {
  estimateRowHeight: 56,
  overscan: 8,
  rowCountThreshold: 100,
  columnCountThreshold: 20,
  columnOverscan: 3
} as const;

export function isBrowserSupportedForVirtualization(): boolean {
  if (typeof ResizeObserver === 'undefined') return false;
  return true;
}

export function isDataTableVirtualizationEnabled(): boolean {
  if (!env.dataTableVirtualization) return false;
  return isBrowserSupportedForVirtualization();
}

type DataTableGateFallbackReason = Exclude<
  DataTableVirtualizationFallbackReason,
  'runtime-error'
>;

interface DataTableVirtualizationResolution {
  gateReason?: DataTableGateFallbackReason;
  onVirtualizationFallback?: DataTableVirtualizationOptions['onVirtualizationFallback'];
  value?: DataTableResolvedVirtualizationOptions;
}

function resolveDataTableVirtualizationMode(
  virtualization?: DataTableVirtualizationProp
): 'auto' | 'on' | 'off' {
  if (virtualization === false) return 'off';
  if (virtualization === true || virtualization === undefined) return 'auto';

  if (virtualization.mode) {
    return virtualization.mode;
  }

  return virtualization.enabled === false ? 'off' : 'auto';
}

function resolveDataTableColumnVirtualizationMode(
  virtualization?: DataTableVirtualizationProp
): 'auto' | 'on' | 'off' {
  if (virtualization === false) return 'off';
  if (typeof virtualization !== 'object' || virtualization === null) return 'off';

  return virtualization.columnVirtualizationMode ?? 'off';
}

function resolveDataTableVirtualizationGateReason(): DataTableGateFallbackReason | undefined {
  if (!env.dataTableVirtualization) {
    return 'disabled-by-config';
  }

  if (!isBrowserSupportedForVirtualization()) {
    return 'unsupported-browser';
  }

  return undefined;
}

export function resolveDataTableVirtualizationOptions(
  virtualization?: DataTableVirtualizationProp
): DataTableVirtualizationResolution {
  const mode = resolveDataTableVirtualizationMode(virtualization);
  const columnMode = resolveDataTableColumnVirtualizationMode(virtualization);
  const config = typeof virtualization === 'object' && virtualization !== null ? virtualization : undefined;

  if (mode === 'off') {
    return {
      value: {
        enabled: false,
        column: {
          enabled: false,
          columnCountThreshold: DATA_TABLE_VIRTUAL_PRESET.columnCountThreshold,
          overscan: DATA_TABLE_VIRTUAL_PRESET.columnOverscan
        },
        onVirtualizationFallback: config?.onVirtualizationFallback
      },
      onVirtualizationFallback: config?.onVirtualizationFallback
    };
  }

  const gateReason = resolveDataTableVirtualizationGateReason();
  if (gateReason) {
    return {
      gateReason,
      onVirtualizationFallback: config?.onVirtualizationFallback
    };
  }

  return {
    onVirtualizationFallback: config?.onVirtualizationFallback,
    value: {
      enabled: true,
      estimateRowHeight: config?.estimateRowHeight,
      overscan: config?.overscan,
      rowCountThreshold: mode === 'on' ? 0 : config?.rowCountThreshold,
      column: {
        enabled: columnMode !== 'off',
        columnCountThreshold:
          columnMode === 'on'
            ? 0
            : (config?.columnCountThreshold ?? DATA_TABLE_VIRTUAL_PRESET.columnCountThreshold),
        overscan: config?.columnOverscan ?? DATA_TABLE_VIRTUAL_PRESET.columnOverscan
      },
      onVirtualizationFallback: config?.onVirtualizationFallback
    }
  };
}

export const dataTableConfig = {
  textOperators: [
    { label: 'Contains', value: 'iLike' as const },
    { label: 'Does not contain', value: 'notILike' as const },
    { label: 'Is', value: 'eq' as const },
    { label: 'Is not', value: 'ne' as const },
    { label: 'Is empty', value: 'isEmpty' as const },
    { label: 'Is not empty', value: 'isNotEmpty' as const }
  ],
  numericOperators: [
    { label: 'Is', value: 'eq' as const },
    { label: 'Is not', value: 'ne' as const },
    { label: 'Is less than', value: 'lt' as const },
    { label: 'Is less than or equal to', value: 'lte' as const },
    { label: 'Is greater than', value: 'gt' as const },
    { label: 'Is greater than or equal to', value: 'gte' as const },
    { label: 'Is between', value: 'isBetween' as const },
    { label: 'Is empty', value: 'isEmpty' as const },
    { label: 'Is not empty', value: 'isNotEmpty' as const }
  ],
  dateOperators: [
    { label: 'Is', value: 'eq' as const },
    { label: 'Is not', value: 'ne' as const },
    { label: 'Is before', value: 'lt' as const },
    { label: 'Is after', value: 'gt' as const },
    { label: 'Is on or before', value: 'lte' as const },
    { label: 'Is on or after', value: 'gte' as const },
    { label: 'Is between', value: 'isBetween' as const },
    { label: 'Is relative to today', value: 'isRelativeToToday' as const },
    { label: 'Is empty', value: 'isEmpty' as const },
    { label: 'Is not empty', value: 'isNotEmpty' as const }
  ],
  selectOperators: [
    { label: 'Is', value: 'eq' as const },
    { label: 'Is not', value: 'ne' as const },
    { label: 'Is empty', value: 'isEmpty' as const },
    { label: 'Is not empty', value: 'isNotEmpty' as const }
  ],
  multiSelectOperators: [
    { label: 'Has any of', value: 'inArray' as const },
    { label: 'Has none of', value: 'notInArray' as const },
    { label: 'Is empty', value: 'isEmpty' as const },
    { label: 'Is not empty', value: 'isNotEmpty' as const }
  ],
  booleanOperators: [
    { label: 'Is', value: 'eq' as const },
    { label: 'Is not', value: 'ne' as const }
  ],
  sortOrders: [
    { label: 'Asc', value: 'asc' as const },
    { label: 'Desc', value: 'desc' as const }
  ],
  filterVariants: [
    'text',
    'number',
    'range',
    'date',
    'dateRange',
    'boolean',
    'select',
    'multiSelect'
  ] as const,
  operators: [
    'iLike',
    'notILike',
    'eq',
    'ne',
    'inArray',
    'notInArray',
    'isEmpty',
    'isNotEmpty',
    'lt',
    'lte',
    'gt',
    'gte',
    'isBetween',
    'isRelativeToToday'
  ] as const,
  joinOperators: ['and', 'or'] as const,
  columnResizeStorage: 'localStorage' as 'localStorage' | 'sessionStorage' | false,
  columnOrderStorage: 'localStorage' as 'localStorage' | 'sessionStorage' | false
};
