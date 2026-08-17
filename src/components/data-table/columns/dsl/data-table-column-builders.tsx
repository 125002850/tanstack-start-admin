import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import {
  type ActionsDslColumnOptions,
  type BadgeDslColumnOptions,
  type CustomDslColumnOptions,
  type DataTableColumn,
  type DataTableColumnDslOptions
} from '@/components/data-table/columns/dsl/data-table-column-builder-types';
import { renderDataTableActionsCell } from '@/components/data-table/columns/dsl/data-table-column-actions';
import {
  ACTIONS_COLUMN_DEFAULTS,
  BADGE_COLUMN_DEFAULTS,
  CUSTOM_COLUMN_DEFAULTS
} from '@/components/data-table/columns/dsl/data-table-column-defaults';
import { createDataTableEditableFieldBuilder } from '@/components/data-table/columns/dsl/data-table-editable-column-builder';
import type { DataTableColumnKey } from '@/components/data-table/columns/dsl/data-table-column-formatters';
import {
  createDataTableColumnBuilderContext,
  createDataTableFieldBuilder,
  eraseDataTableColumnValue
} from '@/components/data-table/columns/dsl/data-table-field-column-builder';
import { resolveDataTableColumnOptions } from '@/components/data-table/columns/dsl/data-table-column-options';
import { dataTableHeaderFactory } from '@/components/data-table/columns/dsl/data-table-column-rendering';
import { nullableText } from '@/lib/formatters/display';
import type { DataTableAuditFields } from '@/types/data-table';

/**
 * 创建 DataTable 列声明 DSL。
 *
 * DSL 的目标是把列宽、类型、格式化、筛选、复制值、列面板行为和后端查询 meta
 * 收敛到一处声明，避免业务页面直接拼装大量 TanStack ColumnDef 细节。
 */
export function createDataTableColumnDsl<TData>(options: DataTableColumnDslOptions<TData> = {}) {
  const context = createDataTableColumnBuilderContext(options);
  const field = createDataTableFieldBuilder(context);
  const editableField = createDataTableEditableFieldBuilder(context, field);

  function badge<TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    badgeOptions: BadgeDslColumnOptions<TData, TKey> = {}
  ): DataTableColumn<TData> {
    const {
      variant = 'secondary',
      format,
      formatValue,
      header,
      headerClassName,
      headerAlign,
      cellClassName,
      ...columnOptions
    } = badgeOptions;
    const formatter = format ?? formatValue;
    const resolvedOptions = resolveDataTableColumnOptions<TData, TData[TKey]>({
      title,
      defaults: { ...BADGE_COLUMN_DEFAULTS, localFilter: 'text' },
      options: {
        ...columnOptions,
        localFilterFormatValue: (value, row) =>
          formatter ? formatter(value as TData[TKey], row) : value
      }
    });

    return eraseDataTableColumnValue({
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title, headerClassName, headerAlign),
      cell: ({ row }) => {
        const value = row.original[key];
        const label = nullableText(formatter ? formatter(value, row.original) : value);
        // 空值保持纯文本占位，不渲染空 Badge，避免状态列误传达“有一个标签”。
        if (label === '-') return '-';
        const resolvedVariant =
          typeof variant === 'function' ? variant(value, row.original) : variant;
        return (
          <Badge variant={resolvedVariant} className={cellClassName}>
            {label}
          </Badge>
        );
      },
      ...resolvedOptions
    } satisfies ColumnDef<TData, TData[TKey]>);
  }

  function actions(actionsOptions: ActionsDslColumnOptions<TData>): DataTableColumn<TData> {
    const {
      id = 'actions',
      title = '操作',
      actions: rowActions,
      header,
      headerAlign,
      headerClassName,
      meta,
      ...columnOptions
    } = actionsOptions;
    // 操作列默认不参与筛选/隐藏/重排，但仍允许调用方覆盖宽度范围和 meta。
    const resolvedOptions = resolveDataTableColumnOptions<TData, unknown>({
      title,
      defaults: ACTIONS_COLUMN_DEFAULTS,
      options: {
        ...columnOptions,
        filter: false,
        meta
      }
    });

    return {
      id,
      header: header ?? dataTableHeaderFactory<TData>(title, headerClassName, headerAlign),
      cell: ({ row }) => renderDataTableActionsCell(row, rowActions),
      ...resolvedOptions
    } satisfies ColumnDef<TData>;
  }

  function custom<TValue = unknown>(
    customOptions: CustomDslColumnOptions<TData, TValue>
  ): DataTableColumn<TData> {
    const { id, title, accessorFn, cell, header, headerAlign, headerClassName, ...columnOptions } =
      customOptions;
    const resolvedOptions = resolveDataTableColumnOptions<TData, TValue>({
      // 自定义列使用 CUSTOM defaults，仍可声明 filter/dsl/columnPanel 等统一选项。
      title,
      defaults: CUSTOM_COLUMN_DEFAULTS,
      options: columnOptions
    });

    return eraseDataTableColumnValue({
      id,
      accessorFn,
      header: header ?? dataTableHeaderFactory<TData>(title, headerClassName, headerAlign),
      cell,
      ...resolvedOptions
    } satisfies ColumnDef<TData, TValue>);
  }

  function createAuditColumns(): DataTableColumn<TData>[] {
    return [
      custom({
        id: 'createInfo',
        title: '创建信息',
        cell: ({ row }) => {
          const record = row.original as TData & DataTableAuditFields;

          return (
            <div className='flex flex-col text-xs'>
              <span className='text-muted-foreground'>
                {record.createByName ?? record.createById ?? '-'}
              </span>
              <span>{record.createTime || '-'}</span>
            </div>
          );
        }
      }),
      custom({
        id: 'updateInfo',
        title: '更新信息',
        cell: ({ row }) => {
          const record = row.original as TData & DataTableAuditFields;

          return (
            <div className='flex flex-col text-xs'>
              <span className='text-muted-foreground'>
                {record.updateByName ?? record.updateById ?? '-'}
              </span>
              <span>{record.updateTime || '-'}</span>
            </div>
          );
        }
      })
    ];
  }

  const audit = createAuditColumns as TData extends DataTableAuditFields
    ? () => DataTableColumn<TData>[]
    : never;

  return {
    formatField: context.formatField,
    field,
    editableField,
    badge,
    actions,
    custom,
    audit
  };
}
