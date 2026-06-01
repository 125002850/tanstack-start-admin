import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';

type TestRow = { id: number; name: string };

const DATA: TestRow[] = [{ id: 1, name: 'Alice' }];

function ViewOptionsHarness({
  columns,
  iconOnly = false
}: {
  columns: ColumnDef<TestRow>[];
  iconOnly?: boolean;
}) {
  const table = useReactTable({
    data: DATA,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableViewOptions table={table} iconOnly={iconOnly} />;
}

afterEach(cleanup);

describe('DataTableViewOptions', () => {
  it('renders the default trigger with visible text', () => {
    render(
      <ViewOptionsHarness
        columns={[
          { accessorKey: 'id', header: 'ID' },
          { accessorKey: 'name', header: 'Name' }
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '切换表格列显示' })).toBeInTheDocument();
    expect(screen.getByText('显示列')).toBeInTheDocument();
  });

  it('renders an icon-only trigger without visible text when requested', () => {
    render(
      <ViewOptionsHarness
        iconOnly
        columns={[
          { accessorKey: 'id', header: 'ID' },
          { accessorKey: 'name', header: 'Name' }
        ]}
      />
    );

    const trigger = screen.getByRole('button', { name: '切换表格列显示' });
    expect(trigger).toHaveClass('w-8', 'p-0');
    expect(screen.queryByText('显示列')).toBeNull();
  });

  it('returns null when there are no hideable data columns', () => {
    render(
      <ViewOptionsHarness
        columns={[
          { accessorKey: 'id', header: 'ID', enableHiding: false },
          { accessorKey: 'name', header: 'Name', enableHiding: false }
        ]}
      />
    );

    expect(screen.queryByRole('button', { name: '切换表格列显示' })).toBeNull();
  });
});
