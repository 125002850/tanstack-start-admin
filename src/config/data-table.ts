import { env } from './env';
import type {
  DataTableResolvedVirtualizationOptions,
  DataTableVirtualizationFallbackReason,
  DataTableVirtualizationOptions,
  DataTableVirtualizationProp
} from '@/types/data-table';

/**
 * DataTable 全局配置。
 *
 * 这里集中放置筛选操作符、状态持久化默认模式和虚拟滚动预设。特性开关必须从 env 层读取，
 * 不在组件内直接访问 import.meta.env。
 */
export type DataTableConfig = typeof dataTableConfig;

/** 行/列虚拟化的共享默认值，调用方可通过 DataTable virtualization prop 局部覆盖。 */
export const DATA_TABLE_VIRTUAL_PRESET = {
  estimateRowHeight: 42,
  overscan: 8,
  rowCountThreshold: 100,
  columnCountThreshold: 20,
  columnOverscan: 3
} as const;

/** 当前虚拟化实现依赖 ResizeObserver；不支持时直接回退普通渲染。 */
export function isBrowserSupportedForVirtualization(): boolean {
  if (typeof ResizeObserver === 'undefined') return false;
  return true;
}

/** 全局开关和浏览器能力都通过时才允许虚拟化。 */
export function isDataTableVirtualizationEnabled(): boolean {
  if (!env.dataTableVirtualization) return false;
  return isBrowserSupportedForVirtualization();
}

/** @deprecated Use `isDataTableVirtualizationEnabled()` instead. */
export function isProductTableVirtualizationEnabled(): boolean {
  return isDataTableVirtualizationEnabled();
}

type DataTableGateFallbackReason = Exclude<DataTableVirtualizationFallbackReason, 'runtime-error'>;

interface DataTableVirtualizationResolution {
  gateReason?: DataTableGateFallbackReason;
  onVirtualizationFallback?: DataTableVirtualizationOptions['onVirtualizationFallback'];
  value?: DataTableResolvedVirtualizationOptions;
}

function resolveDataTableVirtualizationMode(
  virtualization?: DataTableVirtualizationProp
): 'auto' | 'on' | 'off' {
  // boolean 是旧 API；object.mode 是新 API；未传时默认 auto。
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
  // 列虚拟化默认关闭，必须显式通过 object 配置打开。
  if (virtualization === false) return 'off';
  if (typeof virtualization !== 'object' || virtualization === null) return 'off';

  return virtualization.columnVirtualizationMode ?? 'off';
}

/** 解析虚拟化 gate 的失败原因，供 hook 发出 fallback 事件。 */
function resolveDataTableVirtualizationGateReason(): DataTableGateFallbackReason | undefined {
  if (!env.dataTableVirtualization) {
    return 'disabled-by-config';
  }

  if (!isBrowserSupportedForVirtualization()) {
    return 'unsupported-browser';
  }

  return undefined;
}

/**
 * 解析组件级 virtualization prop。
 *
 * 返回 gateReason 表示“调用方想启用但被环境阻止”；返回 value 表示可以继续由表格根据
 * row/column 阈值决定是否实际虚拟化。
 */
export function resolveDataTableVirtualizationOptions(
  virtualization?: DataTableVirtualizationProp
): DataTableVirtualizationResolution {
  const mode = resolveDataTableVirtualizationMode(virtualization);
  const columnMode = resolveDataTableColumnVirtualizationMode(virtualization);
  const config =
    typeof virtualization === 'object' && virtualization !== null ? virtualization : undefined;

  if (mode === 'off') {
    // 显式关闭时仍返回完整配置对象，调用方可统一读取 virtConfig。
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
        // columnMode='on' 通过阈值 0 表达强制启用，结构性回退由 hook 再判断。
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
  // 以下 operators 主要服务于高级筛选/列配置 UI；后端 DSL 查询有独立的操作符映射。
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
  // 列顺序和排序默认也持久化到 localStorage；单张表可通过 useDataTable props 覆盖。
  columnOrderStorage: 'localStorage' as 'localStorage' | 'sessionStorage' | false,
  sortingStorage: 'localStorage' as 'localStorage' | 'sessionStorage' | false
};
