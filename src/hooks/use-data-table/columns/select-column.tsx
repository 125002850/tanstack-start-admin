import type { ColumnDef } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

import { DATA_TABLE_SELECT_COLUMN_ID, DATA_TABLE_SELECT_COLUMN_WIDTH } from '../constants';

function SelectControl({
  ariaLabel,
  checked,
  onToggle,
  className
}: {
  ariaLabel: string;
  checked: boolean | 'indeterminate';
  onToggle: () => void;
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
      aria-checked={isIndeterminate ? 'mixed' : isChecked}
      aria-label={ariaLabel}
      data-slot='data-table-select-hitbox'
      data-row-expand-ignore
      className={cn(
        'group flex w-full cursor-pointer items-center justify-center px-2 py-2 outline-none',
        className
      )}
      onClick={(event) => {
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
      const checked =
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() ? 'indeterminate' : false);

      return (
        <SelectControl
          ariaLabel='全选'
          checked={checked}
          className='h-full min-h-10'
          onToggle={() => {
            table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
          }}
        />
      );
    },
    cell: ({ row }) => (
      <SelectControl
        ariaLabel='选择行'
        checked={row.getIsSelected()}
        className='h-full min-h-9'
        onToggle={() => {
          row.toggleSelected(!row.getIsSelected());
        }}
      />
    ),
    meta: {
      label: '选择'
    }
  };
}
