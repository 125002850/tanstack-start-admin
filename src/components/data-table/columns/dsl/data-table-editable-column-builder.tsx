import type { ColumnDef } from '@tanstack/react-table';

import type {
  DataTableColumn,
  DataTableEditableFieldBuilder,
  DataTableFieldBuilder,
  EditableRuntimeOptions,
  FieldColumnOptions
} from '@/components/data-table/columns/dsl/types';
import { FIELD_COLUMN_DEFAULTS } from '@/components/data-table/columns/dsl/data-table-column-defaults';
import { resolveDataTableEditableCell } from '@/components/data-table/editing/data-table-edit-adapters';
import type { DataTableColumnKey } from '@/components/data-table/columns/dsl/data-table-column-formatters';
import {
  eraseDataTableColumnValue,
  inferDataTableLocalFilterVariant,
  type DataTableColumnBuilderContext
} from '@/components/data-table/columns/dsl/data-table-field-column-builder';
import { resolveDataTableColumnOptions } from '@/components/data-table/columns/dsl/data-table-column-options';
import {
  dataTableHeaderFactory,
  getDataTableAlignClassName
} from '@/components/data-table/columns/dsl/data-table-column-rendering';
import { resolveDataTableColumnTypeDefaults } from '@/components/data-table/columns/dsl/type-registry';
import { cn } from '@/lib/utils';

/** 创建 editableField builder，并把只读降级交还给普通 field builder。 */
export function createDataTableEditableFieldBuilder<TData>(
  context: DataTableColumnBuilderContext<TData>,
  field: DataTableFieldBuilder<TData>
): DataTableEditableFieldBuilder<TData> {
  function editableField(
    key: DataTableColumnKey<TData>,
    title: string,
    editableOptionsInput: object
  ): DataTableColumn<TData> {
    const editableOptions = editableOptionsInput as EditableRuntimeOptions<TData>;
    const {
      type,
      valueOptions,
      remoteOptions,
      edit,
      format,
      formatValue,
      cellClassName,
      headerClassName,
      headerAlign,
      header,
      ...columnOptions
    } = editableOptions;
    const derivedFilterOptions =
      valueOptions &&
      !columnOptions.filterOptions &&
      (columnOptions.filter === 'select' || columnOptions.filter === 'multiSelect')
        ? valueOptions.map((option) => ({
            label: option.label,
            value: String(option.value)
          }))
        : columnOptions.filterOptions;
    const derivedLocalFilterOptions =
      valueOptions && !columnOptions.localFilterOptions
        ? valueOptions.map((option) => ({
            label: option.label,
            value: String(option.value)
          }))
        : columnOptions.localFilterOptions;
    const resolvedEditable = resolveDataTableEditableCell<TData>({
      type,
      field: key,
      title,
      edit,
      tableId: context.tableId,
      tableTimeZone: context.tableTimeZone,
      appTimeZone: context.appTimeZone,
      valueOptions,
      remoteOptions
    });
    if (!resolvedEditable) {
      const readOnlyOptions = {
        ...columnOptions,
        type,
        format,
        formatValue,
        cellClassName,
        headerClassName,
        headerAlign,
        header,
        filterOptions: derivedFilterOptions
      } as FieldColumnOptions<TData, DataTableColumnKey<TData>>;
      return field(key, title, readOnlyOptions);
    }

    const typeDefaults = resolveDataTableColumnTypeDefaults<TData, unknown>(
      type,
      context.resolvedCustomTypes
    );
    const resolvedCellClassName = cn(
      getDataTableAlignClassName(typeDefaults.align),
      typeDefaults.cellClassName,
      cellClassName
    );
    const resolvedHeaderClassName = cn(typeDefaults.headerClassName, headerClassName);
    const resolvedMeta = {
      ...columnOptions.meta,
      cellOwnsTooltip: true,
      ...resolvedEditable.columnMeta
    };
    const columnFormatter = (format ?? formatValue) as
      | ((value: unknown, row: TData) => unknown)
      | undefined;
    const typeFormatter = typeDefaults.formatValue as
      | ((value: unknown, row: TData) => unknown)
      | undefined;
    const resolveEditableFormattedValue = (value: unknown, row: TData) =>
      resolvedEditable.resolveFormattedValue({
        value,
        row,
        columnFormatter,
        typeFormatter,
        fallbackFormatter: () => context.formatField(key, row)
      });
    const resolveEditableLocalFilterFormattedValue = (value: unknown, row: TData) =>
      Array.isArray(row[key]) ? value : resolveEditableFormattedValue(value, row);

    return eraseDataTableColumnValue({
      accessorKey: key,
      header:
        header ??
        dataTableHeaderFactory<TData>(
          title,
          resolvedHeaderClassName,
          headerAlign ?? typeDefaults.headerAlign
        ),
      cell: (cellContext) => {
        const value = cellContext.getValue();
        const row = cellContext.row.original;
        return resolvedEditable.renderCell({
          context: cellContext,
          formattedValue: resolveEditableFormattedValue(value, row),
          className: resolvedCellClassName
        });
      },
      ...resolveDataTableColumnOptions<TData, unknown>({
        title,
        defaults: {
          ...FIELD_COLUMN_DEFAULTS,
          localFilter: inferDataTableLocalFilterVariant(type, edit?.selectionMode),
          size: typeDefaults.size,
          minSize: typeDefaults.minSize,
          maxSize: typeDefaults.maxSize
        },
        options: {
          ...columnOptions,
          filterOptions: derivedFilterOptions,
          localFilterOptions: derivedLocalFilterOptions,
          localFilterFormatValue: resolveEditableLocalFilterFormattedValue,
          meta: resolvedMeta
        }
      })
    } satisfies ColumnDef<TData, unknown>);
  }

  return editableField;
}
