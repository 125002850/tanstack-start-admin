import type { ColumnDef } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { getPageSelectableRows } from '@/lib/data-table/selection';
import { cn } from '@/lib/utils';

import { DATA_TABLE_SELECT_COLUMN_ID, DATA_TABLE_SELECT_COLUMN_WIDTH } from '../constants';

/**
 * DataTable 自动生成的选择列。
 *
 * 选择状态使用 TanStack rowSelection；当前实现默认只表达当前页选择，不做跨页全选语义。
 */
function SelectControl({
  ariaLabel,
  checked,
  onToggle,
  disabled,
  className
}: {
  ariaLabel: string;
  checked: boolean | 'indeterminate';
  onToggle: () => void;
  disabled: boolean;
  className: string;
}) {
  const isChecked = checked === true;
  const isIndeterminate = checked === 'indeterminate';
  let indicator = null;

  if (isIndeterminate) {
    indicator = <Icons.minus className='size-3' />;
  } else if (isChecked) {
    indicator = <Icons.check className='size-3.5' />;
  }

  return (
    <button
      type='button'
      role='checkbox'
      disabled={disabled}
      aria-checked={isIndeterminate ? 'mixed' : isChecked}
      aria-label={ariaLabel}
      data-slot='data-table-select-hitbox'
      data-row-expand-ignore
      className={cn(
        'group flex w-full disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer items-center justify-center px-2 py-2 outline-none',
        className
      )}
      onClick={(event) => {
        // 选择列不能触发行点击展开。
        event.stopPropagation();
        onToggle();
      }}
    >
      <span
        className={cn(
          'border-border bg-background flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-2 shadow-sm transition-[background-color,border-color,box-shadow] group-hover:border-foreground/70 group-focus-visible:border-ring group-focus-visible:ring-ring/50 group-focus-visible:ring-[3px]',
          (isChecked || isIndeterminate) &&
            'border-primary bg-primary text-primary-foreground group-hover:border-primary dark:bg-primary'
        )}
      >
        {indicator}
      </span>
    </button>
  );
}

export function createSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: DATA_TABLE_SELECT_COLUMN_ID,
    size: DATA_TABLE_SELECT_COLUMN_WIDTH,
    minSize: DATA_TABLE_SELECT_COLUMN_WIDTH,
    maxSize: DATA_TABLE_SELECT_COLUMN_WIDTH,
    enableResizing: false,
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
    header: ({ table }) => {
      const isTree = Boolean(table.options.meta?.dataTableTree);
      const selectableRows = getPageSelectableRows(table);
      // 树表的展开只控制显示；全选与摘要都覆盖筛选后保留的可选节点。
      const allSelected = isTree
        ? selectableRows.length > 0 && selectableRows.every((row) => row.getIsSelected())
        : table.getIsAllPageRowsSelected();
      const someSelected = isTree
        ? selectableRows.some((row) => row.getIsSelected())
        : table.getIsSomePageRowsSelected();
      const checked = allSelected || (someSelected ? 'indeterminate' : false);

      return (
        <SelectControl
          ariaLabel='全选'
          disabled={selectableRows.length === 0}
          checked={checked}
          className='h-full min-h-10'
          onToggle={() => {
            if (isTree) {
              table.setRowSelection((current) => {
                const next = { ...current };
                for (const row of getPageSelectableRows(table)) {
                  if (allSelected) delete next[row.id];
                  else next[row.id] = true;
                }
                return next;
              });
              return;
            }
            table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
          }}
        />
      );
    },
    cell: ({ row, table }) => (
      <SelectControl
        ariaLabel='选择行'
        disabled={!row.getCanSelect()}
        checked={row.getIsSelected()}
        className='h-full min-h-9'
        onToggle={() => {
          row.toggleSelected(
            !row.getIsSelected(),
            table.options.meta?.dataTableTree ? { selectChildren: false } : undefined
          );
        }}
      />
    ),
    meta: {
      label: '选择'
    }
  };
}
