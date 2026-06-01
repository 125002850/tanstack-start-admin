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
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableRowAction } from '@/components/ui/table/data-table-row-action';
import * as React from 'react';
import userEvent from '@testing-library/user-event';

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

function ExpandHarness({
  rows,
  virtualization,
  rowActions,
  expandConfigOverride
}: {
  rows: TestRow[];
  virtualization?: {
    enabled: boolean;
    estimateRowHeight?: number;
    overscan?: number;
    rowCountThreshold?: number;
  };
  rowActions?: DataTableRowAction<TestRow>[];
  expandConfigOverride?: {
    rowKey: 'id';
    tabs: Array<{
      id: string;
      label: string;
      disabled?: boolean | ((row: TestRow) => boolean);
      render: (row: TestRow) => React.ReactNode;
    }>;
    defaultTab?: string;
  };
}) {
  const expandConfig =
    expandConfigOverride ??
    ({
      rowKey: 'id',
      tabs: [
        {
          id: 'summary',
          label: '概览',
          render: (row: TestRow) => <div>{`summary:${row.name}`}</div>
        }
      ]
    } as const);

  const {
    table,
    expandedRow,
    expandedRowKey,
    setExpandedRowKey,
    expandPanelId
  } = useDataTable({
    data: rows,
    columns: COLUMNS,
    pageCount: 1,
    showRowNumberColumn: false,
    rowActions,
    tableId: 'test-users',
    expandConfig
  });

  return (
    <div>
      <span data-testid='expanded-row-key'>{expandedRowKey ?? 'null'}</span>
      <span data-testid='expanded-row-name'>{expandedRow?.name ?? 'null'}</span>
      <DataTable
        table={table}
        virtualization={virtualization}
        expandConfig={expandConfig}
        expandedRow={expandedRow}
        expandedRowKey={expandedRowKey}
        onExpandedRowKeyChange={setExpandedRowKey}
        expandPanelId={expandPanelId}
      />
    </div>
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

  it('expands the clicked row when clicking normal cell content', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 2'));

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('2');
    expect(screen.getByTestId('expanded-row-name').textContent).toBe('Item 2');
  });

  it('does not expand when clicking a row action button', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <ExpandHarness
        rows={makeRows(5)}
        rowActions={[
          {
            label: '编辑',
            icon: <span>edit</span>,
            onClick: onEdit
          }
        ]}
      />
    );

    const actionButtons = screen.getAllByRole('button', { name: '编辑' });
    await user.click(actionButtons[0]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
  });

  it('applies the same row-click boundary rules in the virtualized branch', async () => {
    const user = userEvent.setup();

    render(
      <ExpandHarness
        rows={makeRows(200)}
        virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }}
      />
    );

    const firstRowText = screen.getAllByText('Item 1').at(-1);
    if (!firstRowText) {
      throw new Error('row text for Item 1 missing');
    }

    await user.click(firstRowText);

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('1');
  });

  it('renders and closes the expand panel after a row is opened', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(5)} />);

    const firstRowText = screen.getAllByText('Item 1').at(-1);
    if (!firstRowText) {
      throw new Error('row text for Item 1 missing');
    }

    await user.click(firstRowText);

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('1');
    expect(screen.getByText('summary:Item 1')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '关闭详情面板' }));

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).toBeNull();
  });

  it('preserves splitter height on same-row click and after close/reopen within the same mount', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));

    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{End}');

    expect(separator).toHaveAttribute('aria-valuenow', '642');

    const sameRowText = screen.getAllByText('Item 1').at(-1);
    if (!sameRowText) {
      throw new Error('row text for Item 1 missing');
    }

    await user.click(sameRowText);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '642');

    await user.click(screen.getByRole('button', { name: '关闭详情面板' }));
    await user.click(screen.getByText('Item 2'));

    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '642');
  });

  it('resets splitter height after remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));

    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{End}');
    expect(separator).toHaveAttribute('aria-valuenow', '642');

    unmount();
    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '480');
  });

  it('falls back to the default available tab when switching rows invalidates the active tab', async () => {
    const user = userEvent.setup();

    render(
      <ExpandHarness
        rows={makeRows(5)}
        expandConfigOverride={{
          rowKey: 'id',
          defaultTab: 'summary',
          tabs: [
            {
              id: 'summary',
              label: '概览',
              render: (row) => <div>{`summary:${row.name}`}</div>
            },
            {
              id: 'audit',
              label: '审计',
              disabled: (row) => row.id === 2,
              render: (row) => <div>{`audit:${row.name}`}</div>
            }
          ]
        }}
      />
    );

    await user.click(screen.getByText('Item 1'));
    await user.click(screen.getByRole('tab', { name: '审计' }));

    expect(screen.getByText('audit:Item 1')).toBeInTheDocument();

    await user.click(screen.getByText('Item 2'));

    expect(screen.getByText('summary:Item 2')).toBeInTheDocument();
    expect(screen.queryByText('audit:Item 2')).toBeNull();
  });
});
