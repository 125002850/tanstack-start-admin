import { render, screen } from '@testing-library/react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { DataTablePagination } from './data-table-pagination';

type TestRow = { id: number; name: string };

const columns: Array<ColumnDef<TestRow>> = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];

const rows: TestRow[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`
}));

function Harness({
  totalRowCount,
  selectedRowCount,
  rowSelection
}: {
  totalRowCount?: number;
  selectedRowCount?: number;
  rowSelection?: Record<string, boolean>;
}) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 5, pageIndex: 0 },
      rowSelection
    }
  });

  return (
    <DataTablePagination
      table={table}
      totalRowCount={totalRowCount}
      selectedRowCount={selectedRowCount}
    />
  );
}

describe('DataTablePagination', () => {
  it('prefers the server total row count when provided', () => {
    render(<Harness totalRowCount={42} />);

    expect(screen.getByText('共 42 条数据')).toBeInTheDocument();
  });

  it('falls back to the filtered row count when no server total is provided', () => {
    render(<Harness />);

    expect(screen.getByText('共 5 条数据')).toBeInTheDocument();
  });

  it('uses the current page row count for selected summary when selectedRowCount is implicit', () => {
    render(<Harness totalRowCount={42} rowSelection={{ '0': true }} />);

    expect(screen.getByText('已选择 1 / 5 行')).toBeInTheDocument();
  });

  it('uses the provided selectedRowCount with the server total when explicitly controlled', () => {
    render(<Harness totalRowCount={42} selectedRowCount={7} rowSelection={{ '0': true }} />);

    expect(screen.getByText('已选择 7 / 42 行')).toBeInTheDocument();
  });
});
