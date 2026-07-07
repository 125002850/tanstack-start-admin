import type { Row } from '@tanstack/react-table';
import * as React from 'react';

import {
  DataTableRowActions,
  type DataTableRowAction
} from '@/components/ui/table/actions/data-table-row-action';
import type { DataTableRowActionOption } from '@/types/data-table';

/**
 * 把 DSL 的行操作声明转换为真正的 DataTableRowActions 渲染配置。
 *
 * 这里保留 tableRow 上下文，便于 onSelect 同时拿到业务 row.original 和 TanStack Row。
 */
export type DataTableRowActionsResolver<TData> = (
  tableRow: Row<TData>
) => Array<DataTableRowAction<TData>>;

interface DataTableRowActionTemplate<TData> {
  label: string;
  icon: React.ReactNode;
  disabled?: DataTableRowActionOption<TData>['disabled'];
  hidden?: DataTableRowActionOption<TData>['hidden'];
  onSelect?: DataTableRowActionOption<TData>['onSelect'];
}

function renderActionIcon(icon: DataTableRowActionOption<unknown>['icon']) {
  if (!icon) {
    return null;
  }

  if (typeof icon === 'function') {
    return React.createElement(icon, { className: 'size-4' });
  }

  return icon;
}

/** 行操作的 disabled/hidden 支持静态值或基于 row 的函数，这里统一解析。 */
function resolveRowActionValue<TData, TValue>(
  value: TValue | ((row: TData) => TValue) | undefined,
  row: TData,
  fallback: TValue
): TValue {
  if (value === undefined) {
    return fallback;
  }

  return typeof value === 'function' ? (value as (row: TData) => TValue)(row) : value;
}

/**
 * 创建行操作解析器。
 *
 * 模板对象只构建一次；每个 TanStack Row 解析后的 action 会放进 WeakMap，避免同一行
 * 在重渲染时反复生成回调数组，也不阻止 Row 被垃圾回收。
 */
export function createDataTableRowActionsResolver<TData>(
  actions: Array<DataTableRowActionOption<TData>>
): DataTableRowActionsResolver<TData> {
  const templates: Array<DataTableRowActionTemplate<TData>> = actions.map((action) => ({
    label: action.label,
    icon: renderActionIcon(action.icon as DataTableRowActionOption<unknown>['icon']),
    disabled: action.disabled,
    hidden: action.hidden,
    onSelect: action.onSelect
  }));
  const rowActionCache = new WeakMap<Row<TData>, Array<DataTableRowAction<TData>>>();

  return (tableRow) => {
    const cachedActions = rowActionCache.get(tableRow);

    if (cachedActions) {
      return cachedActions;
    }

    const resolvedActions = templates.map((template) => ({
      label: template.label,
      icon: template.icon,
      disabled: (row: TData) => resolveRowActionValue(template.disabled, row, false),
      hidden: (row: TData) => resolveRowActionValue(template.hidden, row, false),
      onClick: (row: TData) => template.onSelect?.({ row, tableRow })
    }));

    rowActionCache.set(tableRow, resolvedActions);
    return resolvedActions;
  };
}

export function renderDataTableActionsCell<TData>(
  row: Row<TData>,
  resolveActions: DataTableRowActionsResolver<TData>
) {
  // 统一入口，方便 DSL actions 列和手写 actions 列复用相同渲染组件。
  return <DataTableRowActions row={row.original} actions={resolveActions(row)} />;
}
