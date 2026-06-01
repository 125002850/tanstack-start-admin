import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  getPaginationRowModel
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import type { DataTableAction } from '@/components/ui/table/data-table-actions-bar';
import * as React from 'react';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    enabled,
    estimateSize
  }: {
    count: number;
    enabled?: boolean;
    estimateSize: () => number;
  }) => {
    const size = estimateSize();
    const virtualItems = enabled
      ? Array.from({ length: Math.min(count, 4) }, (_, index) => ({
          index,
          start: index * size,
          size
        }))
      : [];

    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * size,
      scrollToIndex: vi.fn(),
      measure: vi.fn()
    };
  }
}));

// Mock ScrollArea — avoids Radix instance conflicts in jsdom
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
    viewportProps
  }: {
    children: React.ReactNode;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: Record<string, unknown>;
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined;
    return (
      <div data-testid='scroll-area'>
        <div ref={viewportRef} data-scroll-target-id={id} data-testid='scroll-viewport'>
          {children}
        </div>
      </div>
    );
  },
  ScrollBar: () => null
}));

vi.mock('@/components/ui/table/data-table-view-options', () => ({
  DataTableViewOptions: ({
    iconOnly,
    className
  }: {
    table: unknown;
    iconOnly?: boolean;
    className?: string;
  }) => (
    <button
      data-testid='view-options-button'
      data-icon-only={iconOnly ? 'true' : 'false'}
      className={className}
    >
      显示列
    </button>
  )
}));

type TestRow = { id: number; name: string };

const COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];

const SIZED_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 170 }
];

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
}

function useHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

function useSizedHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: SIZED_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

function Harness({
  rows,
  virtualization
}: {
  rows: TestRow[];
  virtualization?: {
    enabled: boolean;
    estimateRowHeight?: number;
    overscan?: number;
    rowCountThreshold?: number;
  };
}) {
  const table = useHarnessTable(rows, rows.length);
  return <DataTable table={table} virtualization={virtualization} />;
}

function SizedHarness({ rows }: { rows: TestRow[] }) {
  const table = useSizedHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function ControlsHarness({
  toolbar,
  actions
}: {
  toolbar?: React.ReactNode;
  actions?: DataTableAction<TestRow>[];
}) {
  const table = useHarnessTable(makeRows(5), 5);

  return (
    <DataTable table={table} tableActions={actions}>
      {toolbar}
    </DataTable>
  );
}

afterEach(cleanup);

describe('DataTable body', () => {
  it('renders all rows in normal mode', () => {
    const rows = makeRows(10);
    render(<Harness rows={rows} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 10')).toBeInTheDocument();
  });

  it('renders empty message when no rows', () => {
    render(<Harness rows={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('passes scrollTargetId to viewport', () => {
    const rows = makeRows(5);
    function HarnessWithScrollId() {
      const table = useHarnessTable(rows, 5);
      return <DataTable table={table} scrollTargetId='test-table' />;
    }
    render(<HarnessWithScrollId />);
    expect(screen.getByTestId('scroll-viewport')).toHaveAttribute(
      'data-scroll-target-id',
      'test-table'
    );
  });

  it('renders the table using the resolved total column width', () => {
    const rows = makeRows(5);
    const { container } = render(<SizedHarness rows={rows} />);

    const tableEl = container.querySelector('table');
    expect(tableEl?.getAttribute('style')).toContain('width: 250px');
    expect(tableEl?.getAttribute('style')).toContain('table-layout: fixed');
  });

  it('renders a themed separator between toolbar and actions when both exist', () => {
    render(
      <ControlsHarness
        toolbar={<div data-testid='table-toolbar'>toolbar</div>}
        actions={[
          {
            label: '新增用户',
            callback: vi.fn()
          }
        ]}
      />
    );

    expect(screen.getByTestId('table-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '表格操作' })).toBeInTheDocument();
    const viewOptionsButton = screen.getByTestId('view-options-button');
    expect(viewOptionsButton).toHaveAttribute('data-icon-only', 'true');
    expect(viewOptionsButton).toHaveClass('ml-auto');
    expect(viewOptionsButton.parentElement).toContainElement(
      screen.getByRole('group', { name: '表格操作' })
    );
    const separator = document.querySelector('[data-slot="separator"]');
    expect(separator).not.toBeNull();
    expect(separator).toHaveClass(
      'ml-[calc(var(--page-container-padding-x,0rem)*-1)]',
      'data-[orientation=horizontal]:!w-[calc(100%+var(--page-container-padding-x,0rem)*2)]'
    );
  });

  it('does not render the top separator when only one top section exists', () => {
    const { rerender } = render(
      <ControlsHarness toolbar={<div data-testid='table-toolbar'>toolbar</div>} />
    );

    expect(document.querySelector('[data-slot="separator"]')).not.toBeNull();
    expect(screen.getByTestId('view-options-button')).toBeInTheDocument();

    rerender(
      <ControlsHarness
        actions={[
          {
            label: '新增用户',
            callback: vi.fn()
          }
        ]}
      />
    );

    expect(document.querySelector('[data-slot="separator"]')).toBeNull();
    expect(screen.getByTestId('view-options-button')).toBeInTheDocument();
  });

  it('renders all rows when virtualization is disabled', () => {
    const rows = makeRows(150);
    render(<Harness rows={rows} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 150')).toBeInTheDocument();
  });

  it('renders all rows when below threshold', () => {
    const rows = makeRows(50);
    render(<Harness rows={rows} virtualization={{ enabled: true, rowCountThreshold: 100 }} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 50')).toBeInTheDocument();
  });

  it('renders fewer DOM rows when virtualizing above threshold', () => {
    const rows = makeRows(200);
    const { container } = render(
      <Harness rows={rows} virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }} />
    );
    // Virtual scroll with absolute positioning: some rows are rendered, but not all 200
    const rowElements = screen.queryAllByText(/^Item \d+$/);
    expect(rowElements.length).toBeLessThan(200);

    const virtualRows = container.querySelectorAll(
      'tbody[data-virtual-enabled="true"] tr[data-index]'
    );
    expect(virtualRows.length).toBeGreaterThan(0);
    expect((virtualRows[0] as HTMLTableRowElement).style.height).toBe('56px');
  });
});
