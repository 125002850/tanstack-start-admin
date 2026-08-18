import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataTableColumnHeader } from '@/components/data-table/columns/header/data-table-column-header';
import type { DataTableLocalFilteringRuntime } from '@/types/data-table';

interface HeaderTestRow {
  id: number;
  name: string;
}

const SORTABLE_COLUMNS: ColumnDef<HeaderTestRow>[] = [
  { accessorKey: 'id', header: '编号' },
  { accessorKey: 'name', header: '姓名' }
];

const LOCAL_FILTERING_RUNTIME: DataTableLocalFilteringRuntime = {
  filters: [],
  getFilterOptions: () => [],
  getFilterValue: () => undefined,
  setFilterValue: () => undefined,
  reset: () => undefined
};

afterEach(cleanup);

function SortableHeaderHarness({
  align
}: {
  align?: 'left' | 'center' | 'right';
} = {}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data: [
      { id: 1, name: 'Beta' },
      { id: 2, name: 'Alpha' }
    ],
    columns: SORTABLE_COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });
  const column = table.getColumn('name');

  if (!column) return null;

  return (
    <>
      <DataTableColumnHeader column={column} title='姓名' align={align} />
      <output data-testid='sorting-state'>{JSON.stringify(sorting)}</output>
    </>
  );
}

function HideableOnlyHeaderHarness() {
  const table = useReactTable({
    data: [{ id: 1, name: 'Alpha' }],
    columns: [
      {
        accessorKey: 'name',
        header: '姓名',
        enableSorting: false,
        enableHiding: true
      }
    ],
    getCoreRowModel: getCoreRowModel()
  });
  const column = table.getColumn('name');

  if (!column) return null;

  return <DataTableColumnHeader column={column} title='姓名' />;
}

function LocalFilterHeaderHarness({ sortable = true }: { sortable?: boolean }) {
  const table = useReactTable({
    data: [{ id: 1, name: 'Alpha' }],
    columns: [
      {
        accessorKey: 'name',
        header: '姓名',
        enableSorting: sortable,
        meta: { localFilter: { variant: 'text' } }
      }
    ],
    meta: { dataTableLocalFiltering: LOCAL_FILTERING_RUNTIME },
    getCoreRowModel: getCoreRowModel()
  });
  const column = table.getColumn('name');

  if (!column) return null;

  return <DataTableColumnHeader column={column} table={table} title='姓名' />;
}

describe('DataTableColumnHeader', () => {
  it('centers header text by default and supports explicit alignment', () => {
    const { rerender } = render(<SortableHeaderHarness />);

    expect(screen.getByRole('button', { name: '姓名：升序' })).toHaveClass(
      'justify-center',
      'text-center'
    );

    rerender(<SortableHeaderHarness align='left' />);
    expect(screen.getByRole('button', { name: '姓名：升序' })).toHaveClass(
      'justify-start',
      'text-left'
    );

    rerender(<SortableHeaderHarness align='right' />);
    expect(screen.getByRole('button', { name: '姓名：升序' })).toHaveClass(
      'justify-end',
      'text-right'
    );
  });

  it('progresses sorting directly from the header click', async () => {
    const user = userEvent.setup();
    render(<SortableHeaderHarness />);

    const sortButton = screen.getByRole('button', { name: '姓名：升序' });
    expect(screen.getByTestId('sorting-state')).toHaveTextContent('[]');

    await user.click(sortButton);
    expect(screen.getByTestId('sorting-state')).toHaveTextContent(
      JSON.stringify([{ id: 'name', desc: false }])
    );
    expect(sortButton).toHaveAccessibleName('姓名：降序');

    await user.click(sortButton);
    expect(screen.getByTestId('sorting-state')).toHaveTextContent(
      JSON.stringify([{ id: 'name', desc: true }])
    );
    expect(sortButton).toHaveAccessibleName('姓名：重置排序');

    await user.click(sortButton);
    expect(screen.getByTestId('sorting-state')).toHaveTextContent('[]');
    expect(sortButton).toHaveAccessibleName('姓名：升序');
  });

  it('does not turn a hideable-only column into a header action', () => {
    render(<HideableOnlyHeaderHarness />);

    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the local filter in flow and centers sortable content in the remaining space', () => {
    render(<LocalFilterHeaderHarness />);

    const sortButton = screen.getByRole('button', { name: '姓名：升序' });
    const filterButton = screen.getByRole('button', { name: '筛选当前页：姓名' });

    expect(sortButton).toHaveClass('min-w-0', 'flex-1', 'justify-center');
    expect(filterButton).toHaveClass('size-7', 'shrink-0');
    expect(sortButton.parentElement).toBe(filterButton.parentElement);
    expect(filterButton.parentElement).not.toHaveClass('relative', 'absolute');
  });

  it('keeps non-sortable content and the local filter in separate flow slots', () => {
    render(<LocalFilterHeaderHarness sortable={false} />);

    const title = screen.getByText('姓名');
    const filterButton = screen.getByRole('button', { name: '筛选当前页：姓名' });
    const titleRegion = title.closest('[data-slot="data-table-column-header-content"]');

    expect(titleRegion).toHaveClass('min-w-0', 'flex-1', 'justify-center');
    expect(titleRegion?.parentElement).toBe(filterButton.parentElement);
    expect(filterButton.parentElement).not.toHaveClass('relative', 'absolute');
  });
});
