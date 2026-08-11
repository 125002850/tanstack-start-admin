import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataTableColumnHeader } from '@/components/data-table/columns/data-table-column-header';

interface HeaderTestRow {
  id: number;
  name: string;
}

const SORTABLE_COLUMNS: ColumnDef<HeaderTestRow>[] = [
  { accessorKey: 'id', header: '编号' },
  { accessorKey: 'name', header: '姓名' }
];

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
});
