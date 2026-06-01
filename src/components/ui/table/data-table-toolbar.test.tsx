import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import * as React from 'react';

// DataTableViewOptions is always rendered by DataTableToolbar — mock it to avoid
// Radix Popover / Command complexity in jsdom.
vi.mock('@/components/ui/table/data-table-view-options', () => ({
  DataTableViewOptions: () => null
}));

// Mock sub-components so we can verify the variant dispatch logic without
// pulling in full Radix Popover / Calendar / Slider implementations.
vi.mock('@/components/ui/table/data-table-faceted-filter', () => ({
  DataTableFacetedFilter: ({
    title
  }: {
    column: unknown;
    title?: string;
    options: unknown[];
    multiple?: boolean;
  }) => (
    <div data-testid='faceted-filter'>
      <button>{title}</button>
    </div>
  )
}));

vi.mock('@/components/ui/table/data-table-date-filter', () => ({
  DataTableDateFilter: ({ title }: { column: unknown; title?: string; multiple?: boolean }) => (
    <div data-testid='date-filter'>
      <button>{title}</button>
    </div>
  )
}));

vi.mock('@/components/ui/table/data-table-slider-filter', () => ({
  DataTableSliderFilter: ({ title }: { column: unknown; title?: string }) => (
    <div data-testid='slider-filter'>
      <span data-testid='slider-element'>{title}</span>
    </div>
  )
}));

// ── Shared test data & helpers ─────────────────────────────────────────────

type TestRow = {
  id: number;
  name: string;
  category: string;
  price: number;
};

const DATA: TestRow[] = [
  { id: 1, name: 'Item 1', category: 'A', price: 50 },
  { id: 2, name: 'Item 2', category: 'B', price: 100 }
];

interface ToolbarHarnessProps {
  columns: ColumnDef<TestRow>[];
  initialState?: { columnFilters?: { id: string; value: unknown }[] };
}

/** Renders DataTableToolbar with a useReactTable instance created inside a component. */
function ToolbarHarness({ columns, initialState }: ToolbarHarnessProps) {
  const table = useReactTable({
    data: DATA,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState
  });
  return <DataTableToolbar table={table} />;
}

afterEach(cleanup);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DataTableToolbar filter variant dispatch', () => {
  it('renders text filter input for columns with variant: "text"', () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        meta: { variant: 'text' as const, label: 'Name' }
      }
    ];
    render(<ToolbarHarness columns={columns} />);

    // DebouncedFilterInput renders <Input> → native <input> element
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders faceted filter for columns with variant: "multiSelect"', () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        accessorKey: 'category',
        header: 'Category',
        meta: {
          variant: 'multiSelect' as const,
          label: 'Category',
          options: [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' }
          ]
        }
      }
    ];
    render(<ToolbarHarness columns={columns} />);

    expect(screen.getByTestId('faceted-filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Category' })).toBeInTheDocument();
  });

  it('renders date filter for columns with variant: "date"', () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        accessorKey: 'name',
        header: 'Date',
        meta: { variant: 'date' as const, label: 'Date' }
      }
    ];
    render(<ToolbarHarness columns={columns} />);

    expect(screen.getByTestId('date-filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument();
  });

  it('renders slider filter for columns with variant: "range"', () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        accessorKey: 'price',
        header: 'Price',
        meta: {
          variant: 'range' as const,
          label: 'Price',
          range: [0, 100] as [number, number]
        }
      }
    ];
    render(<ToolbarHarness columns={columns} />);

    expect(screen.getByTestId('slider-filter')).toBeInTheDocument();
    expect(screen.getByTestId('slider-element')).toBeInTheDocument();
  });

  it('skips columns without enableColumnFilter', () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        meta: { variant: 'text' as const },
        enableColumnFilter: false
      },
      {
        accessorKey: 'category',
        header: 'Category',
        meta: { variant: 'multiSelect' as const, options: [] },
        enableColumnFilter: false
      },
      {
        accessorKey: 'price',
        header: 'Price',
        meta: { variant: 'range' as const, range: [0, 100] as [number, number] },
        enableColumnFilter: false
      }
    ];
    render(<ToolbarHarness columns={columns} />);

    // No filter components should be rendered
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('faceted-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('date-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slider-filter')).not.toBeInTheDocument();
  });

  it('renders reset filters button when filters are active', () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        meta: { variant: 'text' as const }
      }
    ];
    render(
      <ToolbarHarness
        columns={columns}
        initialState={{
          columnFilters: [{ id: 'name', value: 'test' }]
        }}
      />
    );

    // The reset button has aria-label "重置筛选条件"
    expect(screen.getByRole('button', { name: '重置筛选条件' })).toBeInTheDocument();
  });
});
