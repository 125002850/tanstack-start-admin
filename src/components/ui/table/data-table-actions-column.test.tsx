import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';

import { DataTable } from '@/components/ui/table/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import {
  getDataTableRowActionsColumnWidth,
  type DataTableRowAction
} from '@/components/ui/table/data-table-row-action';

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

type TestRow = { id: number; name: string };

const DATA: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];

const COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 160 }
];

const SELECTABLE_COLUMNS: ColumnDef<TestRow>[] = [
  {
    id: 'select',
    header: 'Select',
    cell: () => null,
    size: 40,
    minSize: 40,
    maxSize: 40,
    enableResizing: false
  },
  ...COLUMNS
];

const ROW_ACTIONS: DataTableRowAction<TestRow>[] = [
  {
    label: '编辑',
    icon: <span>edit</span>,
    onClick: vi.fn()
  }
];

function createRowActions(count: number): DataTableRowAction<TestRow>[] {
  return Array.from({ length: count }, (_, index) => ({
    label: `操作 ${index + 1}`,
    icon: <span>{`icon-${index + 1}`}</span>,
    onClick: vi.fn()
  }));
}

function ActionColumnStateHarness({
  actionColumnPin = 'right',
  rowActions = ROW_ACTIONS,
  initialState,
  columns = COLUMNS,
  showRowNumberColumn = false,
  expandEnabled = false
}: {
  actionColumnPin?: 'left' | 'right';
  rowActions?: DataTableRowAction<TestRow>[];
  columns?: ColumnDef<TestRow>[];
  showRowNumberColumn?: boolean;
  initialState?: {
    columnPinning?: {
      left?: string[];
      right?: string[];
    };
    columnOrder?: string[];
  };
  expandEnabled?: boolean;
}) {
  const { table } = useDataTable({
    data: DATA,
    columns,
    pageCount: 1,
    showRowNumberColumn,
    actionColumnPin,
    rowActions,
    initialState,
    expandConfig: expandEnabled
      ? {
          rowKey: 'id',
          tabs: [
            {
              id: 'summary',
              label: '概览',
              render: (row) => row.name
            }
          ]
        }
      : undefined
  });

  const actionsColumn = table.getColumn('actions');
  const columnPinning = table.getState().columnPinning;

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'left', 'data-testid': 'left-pinning' },
      JSON.stringify(columnPinning.left ?? [])
    ),
    React.createElement(
      'span',
      { key: 'right', 'data-testid': 'right-pinning' },
      JSON.stringify(columnPinning.right ?? [])
    ),
    React.createElement(
      'span',
      { key: 'resize', 'data-testid': 'actions-can-resize' },
      String(actionsColumn?.getCanResize() ?? '')
    ),
    React.createElement(
      'span',
      { key: 'size', 'data-testid': 'actions-size' },
      String(actionsColumn?.getSize() ?? '')
    ),
    React.createElement(
      'span',
      { key: 'order', 'data-testid': 'column-order' },
      JSON.stringify(table.getState().columnOrder ?? [])
    )
  ]);
}

function ActionColumnRenderHarness({
  actionColumnPin = 'right',
  rowActions = ROW_ACTIONS
}: {
  actionColumnPin?: 'left' | 'right';
  rowActions?: DataTableRowAction<TestRow>[];
}) {
  const { table } = useDataTable({
    data: DATA,
    columns: COLUMNS,
    pageCount: 1,
    showRowNumberColumn: false,
    actionColumnPin,
    rowActions
  });

  return <DataTable table={table} />;
}

afterEach(cleanup);

describe('DataTable actions column', () => {
  it('pins the actions column to the right by default and disables resizing', () => {
    const { getByTestId } = render(<ActionColumnStateHarness />);

    expect(getByTestId('left-pinning').textContent).toBe('[]');
    expect(getByTestId('right-pinning').textContent).toBe(JSON.stringify(['actions']));
    expect(getByTestId('actions-can-resize').textContent).toBe('false');
    expect(getByTestId('actions-size').textContent).toBe(
      String(getDataTableRowActionsColumnWidth(1))
    );
  });

  it('can pin the actions column to the left', () => {
    const { getByTestId } = render(<ActionColumnStateHarness actionColumnPin='left' />);

    expect(getByTestId('left-pinning').textContent).toBe(JSON.stringify(['actions']));
    expect(getByTestId('right-pinning').textContent).toBe('[]');
  });

  it('keeps row number, checkbox, and actions as a unified left-pinned group', () => {
    const { getByTestId } = render(
      <ActionColumnStateHarness
        actionColumnPin='left'
        columns={SELECTABLE_COLUMNS}
        showRowNumberColumn
        initialState={{
          columnPinning: {
            left: ['name'],
            right: ['id']
          }
        }}
      />
    );

    expect(getByTestId('left-pinning').textContent).toBe(
      JSON.stringify(['__rowNumber', 'select', 'actions', 'name'])
    );
    expect(getByTestId('right-pinning').textContent).toBe(JSON.stringify(['id']));
  });

  it('keeps row number, checkbox, and actions as a unified left-pinned group when expand uses row highlight only', () => {
    const { getByTestId } = render(
      <ActionColumnStateHarness
        actionColumnPin='left'
        columns={SELECTABLE_COLUMNS}
        showRowNumberColumn
        expandEnabled
        initialState={{
          columnPinning: {
            left: ['name'],
            right: ['id']
          }
        }}
      />
    );

    expect(getByTestId('left-pinning').textContent).toBe(
      JSON.stringify(['__rowNumber', 'select', 'actions', 'name'])
    );
    expect(getByTestId('right-pinning').textContent).toBe(JSON.stringify(['id']));
  });

  it('keeps initialState.columnOrder with leading utility columns when expand is enabled', () => {
    const { getByTestId } = render(
      <ActionColumnStateHarness
        columns={SELECTABLE_COLUMNS}
        expandEnabled
        initialState={{
          columnOrder: ['select', 'name', 'id']
        }}
      />
    );

    expect(getByTestId('column-order').textContent).toBe(JSON.stringify(['select', 'name', 'id']));
  });

  it('re-homes an existing actions pin without duplicating it and keeps it ahead of user columns', () => {
    const { getByTestId } = render(
      <ActionColumnStateHarness
        actionColumnPin='left'
        initialState={{
          columnPinning: {
            left: ['id'],
            right: ['name', 'actions']
          }
        }}
      />
    );

    expect(getByTestId('left-pinning').textContent).toBe(JSON.stringify(['actions', 'id']));
    expect(getByTestId('right-pinning').textContent).toBe(JSON.stringify(['name']));
  });

  it('renders the actions column pinned right without a resize handle', () => {
    const { container } = render(<ActionColumnRenderHarness />);

    const headers = Array.from(container.querySelectorAll('thead th'));
    const actionsHeader = headers.find((header) => header.textContent?.includes('操作'));

    expect(actionsHeader?.getAttribute('style')).toContain('position: sticky');
    expect(actionsHeader?.getAttribute('style')).toContain('right:');
    expect(actionsHeader?.querySelector('[data-resizing]')).toBeNull();
  });

  it('sizes the actions column by the visible action count', () => {
    const { getByTestId, rerender } = render(
      <ActionColumnStateHarness rowActions={createRowActions(2)} />
    );

    expect(getByTestId('actions-size').textContent).toBe(
      String(getDataTableRowActionsColumnWidth(2))
    );

    rerender(<ActionColumnStateHarness rowActions={createRowActions(4)} />);

    expect(getByTestId('actions-size').textContent).toBe(
      String(getDataTableRowActionsColumnWidth(4))
    );
    expect(getDataTableRowActionsColumnWidth(4)).toBe(getDataTableRowActionsColumnWidth(3));
  });

  it('renders a fixed width for more-than-three actions', () => {
    const { container } = render(<ActionColumnRenderHarness rowActions={createRowActions(4)} />);

    const cols = container.querySelectorAll('col');
    expect(cols[2]?.style.width).toBe(`${getDataTableRowActionsColumnWidth(4)}px`);
  });
});
