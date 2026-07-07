import type { Row } from '@tanstack/react-table';
import * as React from 'react';

import {
  DataTableRowActions,
  type DataTableRowAction
} from '@/components/ui/table/actions/data-table-row-action';
import type { DataTableRowActionOption } from '@/types/data-table';

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
  return <DataTableRowActions row={row.original} actions={resolveActions(row)} />;
}
