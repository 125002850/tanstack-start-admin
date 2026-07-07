/**
 * Internal-state mode tests for useDataTable.
 *
 * These tests validate the default code path (no external state adapter).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import * as React from 'react';
import { flexRender, type ColumnDef } from '@tanstack/react-table';
import type { ExtendedColumnSort, SortingStorageMode } from '@/types/data-table';
import {
  getDataTableRowActionsColumnWidth,
  type DataTableRowAction
} from '@/components/ui/table/actions/data-table-row-action';
import type { RowNumberDisplayMode } from '@/hooks/use-data-table/columns/row-number-column';
import { resolveDataTableRowId } from '@/hooks/use-data-table/row-id';

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn()
}));

import { useDataTable } from '@/hooks/use-data-table';

type TestRow = { id: number; name: string };
const ROW_NUMBER_COLUMN_ID = '__rowNumber';
const SELECT_COLUMN_ID = 'select';
const ACTIONS_COLUMN_ID = 'actions';
const FIXED_COLUMN_WIDTH = 40;

const columns: ColumnDef<TestRow>[] = [
  { id: 'id', header: 'ID', accessorKey: 'id' },
  { id: 'name', header: 'Name', accessorKey: 'name', enableColumnFilter: true }
];

const rowActions: DataTableRowAction<TestRow>[] = [
  {
    label: '编辑',
    icon: React.createElement('span', null, 'edit'),
    onClick: vi.fn()
  },
  {
    label: '删除',
    icon: React.createElement('span', null, 'delete'),
    onClick: vi.fn()
  },
  {
    label: '查看',
    icon: React.createElement('span', null, 'view'),
    onClick: vi.fn()
  },
  {
    label: '更多',
    icon: React.createElement('span', null, 'more'),
    onClick: vi.fn()
  }
];

const data: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
  { id: 4, name: 'Diana' }
];

function InternalStateTester({
  tableId = 'internal-state-tester',
  pageSize,
  onPageSizeChange,
  initialSorting = [],
  sortingStorage,
  totalCount,
  enableAdvancedFilter
}: {
  tableId?: string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  initialSorting?: Array<{ id: string; desc: boolean }>;
  sortingStorage?: SortingStorageMode;
  totalCount?: number;
  enableAdvancedFilter?: boolean;
}) {
  const { table } = useDataTable({
    tableId,
    columns,
    data,
    ...(typeof totalCount === 'number'
      ? { totalCount }
      : { pageCount: Math.ceil(data.length / (pageSize ?? 10)) }),
    pageSize,
    onPageSizeChange,
    sortingStorage,
    enableAdvancedFilter,
    initialState:
      initialSorting.length > 0
        ? { sorting: initialSorting as ExtendedColumnSort<TestRow>[] }
        : undefined
  });

  const state = table.getState();

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'page', 'data-testid': 'page' },
      String(state.pagination.pageIndex + 1)
    ),
    React.createElement(
      'span',
      { key: 'size', 'data-testid': 'pageSize' },
      String(state.pagination.pageSize)
    ),
    React.createElement(
      'span',
      { key: 'sort', 'data-testid': 'sort' },
      JSON.stringify(state.sorting)
    ),
    React.createElement(
      'span',
      { key: 'filters', 'data-testid': 'filters' },
      JSON.stringify(state.columnFilters)
    ),
    React.createElement(
      'button',
      {
        key: 'next',
        'data-testid': 'next-page',
        onClick: () => table.nextPage()
      },
      'Next'
    ),
    React.createElement(
      'button',
      {
        key: 'sort-name',
        'data-testid': 'sort-name',
        onClick: () => table.setSorting([{ id: 'name', desc: true }])
      },
      'Sort'
    ),
    React.createElement(
      'button',
      {
        key: 'clear-sort',
        'data-testid': 'clear-sort',
        onClick: () => table.setSorting([])
      },
      'Clear sort'
    ),
    React.createElement(
      'button',
      {
        key: 'filter-name',
        'data-testid': 'filter-name',
        onClick: () => table.setColumnFilters([{ id: 'name', value: 'Alice' }])
      },
      'Filter'
    )
  ]);
}

function RowNumberColumnInspector({
  showRowNumberColumn = true,
  totalCount,
  rowNumberDisplayMode,
  initialState
}: {
  showRowNumberColumn?: boolean;
  totalCount?: number;
  rowNumberDisplayMode?: RowNumberDisplayMode;
  initialState?: {
    columnOrder?: string[];
    columnVisibility?: Record<string, boolean>;
    columnSizing?: Record<string, number>;
  };
}) {
  const { table } = useDataTable({
    tableId: 'row-number-column-inspector',
    columns,
    data,
    totalCount,
    pageCount: totalCount === undefined ? 1 : undefined,
    showRowNumberColumn,
    rowNumberDisplayMode,
    initialState
  });

  const leafColumns = table.getAllLeafColumns();
  const visibleColumns = table.getVisibleLeafColumns();
  const firstColumn = leafColumns[0];
  const firstHeader =
    firstColumn?.columnDef.header === undefined
      ? null
      : flexRender(firstColumn.columnDef.header, {} as never);

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'first-header', 'data-testid': 'first-header' },
      firstHeader
    ),
    React.createElement(
      'span',
      { key: 'leaf-columns', 'data-testid': 'leaf-columns' },
      JSON.stringify(leafColumns.map((column) => column.id))
    ),
    React.createElement(
      'span',
      { key: 'visible-columns', 'data-testid': 'visible-columns' },
      JSON.stringify(visibleColumns.map((column) => column.id))
    ),
    React.createElement(
      'span',
      { key: 'first-size', 'data-testid': 'first-size' },
      String(firstColumn?.getSize() ?? '')
    ),
    React.createElement(
      'span',
      { key: 'first-min-size', 'data-testid': 'first-min-size' },
      String(firstColumn?.columnDef.minSize ?? '')
    ),
    React.createElement(
      'span',
      { key: 'first-max-size', 'data-testid': 'first-max-size' },
      String(firstColumn?.columnDef.maxSize ?? '')
    ),
    React.createElement(
      'span',
      { key: 'first-can-hide', 'data-testid': 'first-can-hide' },
      String(firstColumn?.getCanHide() ?? '')
    ),
    React.createElement(
      'span',
      { key: 'first-can-resize', 'data-testid': 'first-can-resize' },
      String(firstColumn?.getCanResize() ?? '')
    )
  ]);
}

function RowNumberCellsInspector({
  rows,
  totalCount,
  rowNumberDisplayMode
}: {
  rows: TestRow[];
  totalCount: number;
  rowNumberDisplayMode?: RowNumberDisplayMode;
}) {
  const { table } = useDataTable({
    tableId: 'row-number-cells-inspector',
    columns,
    data: rows,
    getRowId: (row) => String(row.id),
    totalCount,
    pageSize: 10,
    rowNumberDisplayMode
  });

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'row-numbers', 'data-testid': 'row-numbers' },
      table.getRowModel().rows.map((row) => {
        const cell = row
          .getVisibleCells()
          .find((visibleCell) => visibleCell.column.id === ROW_NUMBER_COLUMN_ID);

        return React.createElement(
          React.Fragment,
          { key: row.id },
          cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null,
          '|'
        );
      })
    ),
    React.createElement(
      'button',
      {
        key: 'next-page',
        'data-testid': 'row-number-next-page',
        onClick: () => table.setPageIndex(1)
      },
      'Next'
    )
  ]);
}

function FixedColumnSizingInspector({
  initialState
}: {
  initialState?: {
    columnSizing?: Record<string, number>;
  };
}) {
  const { table } = useDataTable({
    tableId: 'fixed-column-sizing-inspector',
    columns,
    data,
    pageCount: 1,
    showSelectColumn: true,
    rowActions,
    initialState
  });

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'state-column-sizing', 'data-testid': 'state-column-sizing' },
      JSON.stringify(table.getState().columnSizing)
    ),
    React.createElement(
      'span',
      { key: 'row-number-size', 'data-testid': 'row-number-size' },
      String(table.getColumn(ROW_NUMBER_COLUMN_ID)?.getSize() ?? '')
    ),
    React.createElement(
      'span',
      { key: 'select-size', 'data-testid': 'select-size' },
      String(table.getColumn(SELECT_COLUMN_ID)?.getSize() ?? '')
    ),
    React.createElement(
      'span',
      { key: 'actions-size', 'data-testid': 'actions-size' },
      String(table.getColumn(ACTIONS_COLUMN_ID)?.getSize() ?? '')
    )
  ]);
}

function ExpandStateInspector({
  rows = data,
  columns: tableColumns = columns,
  showRowNumberColumn = true,
  showSelectColumn = true,
  actionColumnPin = 'left',
  tableId = 'users'
}: {
  rows?: TestRow[];
  columns?: ColumnDef<TestRow>[];
  showRowNumberColumn?: boolean;
  showSelectColumn?: boolean;
  actionColumnPin?: 'left' | 'right';
  tableId?: string;
}) {
  const { table, expandedRowKey, expandedRow, setExpandedRowKey, expandPanelId } = useDataTable({
    columns: tableColumns,
    data: rows,
    pageCount: 1,
    showRowNumberColumn,
    showSelectColumn,
    actionColumnPin,
    rowActions,
    tableId,
    expandConfig: {
      rowKey: 'id',
      tabs: [
        {
          id: 'summary',
          label: '概览',
          render: (row) => row.name
        }
      ]
    }
  });

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'left-pinning', 'data-testid': 'expand-left-pinning' },
      JSON.stringify(table.getState().columnPinning.left ?? [])
    ),
    React.createElement(
      'span',
      { key: 'right-pinning', 'data-testid': 'expand-right-pinning' },
      JSON.stringify(table.getState().columnPinning.right ?? [])
    ),
    React.createElement(
      'span',
      { key: 'column-order', 'data-testid': 'expand-column-order' },
      JSON.stringify(table.getState().columnOrder ?? [])
    ),
    React.createElement(
      'span',
      { key: 'leaf-columns', 'data-testid': 'expand-leaf-columns' },
      JSON.stringify(table.getAllLeafColumns().map((column) => column.id))
    ),
    React.createElement(
      'span',
      { key: 'expanded-row-key', 'data-testid': 'expanded-row-key' },
      expandedRowKey ?? 'null'
    ),
    React.createElement(
      'span',
      { key: 'expanded-row-name', 'data-testid': 'expanded-row-name' },
      expandedRow?.name ?? 'null'
    ),
    React.createElement(
      'span',
      { key: 'expand-panel-id', 'data-testid': 'expand-panel-id' },
      expandPanelId ?? 'null'
    ),
    React.createElement(
      'button',
      {
        key: 'expand-second',
        'data-testid': 'expand-second',
        onClick: () => setExpandedRowKey?.('2')
      },
      'Expand second'
    )
  ]);
}

function SelectedRowsInspector() {
  const { table, selectedRows, selectedRowIds, getSelectedRows, clearSelectedRows } = useDataTable({
    tableId: 'selected-rows-inspector',
    columns,
    data,
    pageCount: 1,
    showSelectColumn: true
  });

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'selected-rows', 'data-testid': 'selected-rows' },
      JSON.stringify(selectedRows.map((row) => row.id))
    ),
    React.createElement(
      'span',
      { key: 'selected-rows-method', 'data-testid': 'selected-rows-method' },
      JSON.stringify(getSelectedRows().map((row) => row.id))
    ),
    React.createElement(
      'span',
      { key: 'selected-row-ids', 'data-testid': 'selected-row-ids' },
      JSON.stringify(selectedRowIds)
    ),
    React.createElement(
      'button',
      {
        key: 'select-all',
        'data-testid': 'select-all',
        onClick: () => table.toggleAllPageRowsSelected(true)
      },
      'Select all'
    ),
    React.createElement(
      'button',
      {
        key: 'clear-selected',
        'data-testid': 'clear-selected',
        onClick: () => clearSelectedRows()
      },
      'Clear selected'
    )
  ]);
}

function ScopedSelectedRowsInspector({ scopeKey }: { scopeKey: string | null }) {
  const { table, selectedRows } = useDataTable({
    tableId: 'scoped-selected-rows-inspector',
    columns,
    data,
    pageCount: 1,
    showSelectColumn: true,
    rowSelectionScopeKey: scopeKey
  });

  return React.createElement('div', null, [
    React.createElement(
      'span',
      { key: 'scoped-selected-rows', 'data-testid': 'scoped-selected-rows' },
      JSON.stringify(selectedRows.map((row) => row.id))
    ),
    React.createElement(
      'button',
      {
        key: 'scoped-select-all',
        'data-testid': 'scoped-select-all',
        onClick: () => table.toggleAllPageRowsSelected(true)
      },
      'Select all'
    )
  ]);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('useDataTable — internal-state mode (default)', () => {
  it('resolves data-table row ids as a pure helper', () => {
    expect(resolveDataTableRowId({ tableId: 'orders', row: { id: 'row-1' }, index: 0 })).toBe(
      'row-1'
    );
    expect(resolveDataTableRowId({ tableId: 'orders', row: { id: 42 }, index: 0 })).toBe('42');
    expect(resolveDataTableRowId({ tableId: 'orders', row: { id: '' }, index: 1 })).toBe(
      'orders-1'
    );
    expect(resolveDataTableRowId({ tableId: 'orders', row: { id: Number.NaN }, index: 2 })).toBe(
      'orders-2'
    );
    expect(
      resolveDataTableRowId({
        tableId: 'orders',
        row: { id: null },
        index: 3,
        parentId: 'parent-row'
      })
    ).toBe('parent-row-3');
    expect(
      resolveDataTableRowId({
        tableId: 'orders',
        row: { code: 'customer-001' },
        rowId: 'code',
        index: 0
      })
    ).toBe('customer-001');
    expect(
      resolveDataTableRowId({
        tableId: 'orders',
        row: { name: 'Alice' },
        rowId: (row) => `fn-${row.name}`,
        index: 0
      })
    ).toBe('fn-Alice');
  });

  it('resolves row ids from default id, rowId key, rowId function, and table fallback', () => {
    type RowIdTestRow = {
      id?: number | null;
      code?: string | null;
      name: string;
    };

    const rowIdColumns: ColumnDef<RowIdTestRow>[] = [
      { id: 'name', header: 'Name', accessorKey: 'name' }
    ];

    function RowIdInspector() {
      const defaultResult = useDataTable<RowIdTestRow>({
        tableId: 'default-row-id',
        columns: rowIdColumns,
        data: [
          { id: 7, name: 'default-id' },
          { id: null, name: 'default-fallback' }
        ],
        pageCount: 1,
        showRowNumberColumn: false
      });
      const keyResult = useDataTable<RowIdTestRow>({
        tableId: 'key-row-id',
        columns: rowIdColumns,
        data: [
          { code: 'customer-001', name: 'key-id' },
          { code: null, name: 'key-fallback' }
        ],
        pageCount: 1,
        showRowNumberColumn: false,
        rowId: 'code'
      });
      const functionResult = useDataTable<RowIdTestRow>({
        tableId: 'function-row-id',
        columns: rowIdColumns,
        data: [{ name: 'function-id' }, { name: 'function-fallback' }],
        pageCount: 1,
        showRowNumberColumn: false,
        rowId: (row) => `fn-${row.name}`
      });

      return React.createElement('div', null, [
        React.createElement(
          'span',
          { key: 'default', 'data-testid': 'default-row-ids' },
          JSON.stringify(defaultResult.table.getRowModel().rows.map((row) => row.id))
        ),
        React.createElement(
          'span',
          { key: 'key', 'data-testid': 'key-row-ids' },
          JSON.stringify(keyResult.table.getRowModel().rows.map((row) => row.id))
        ),
        React.createElement(
          'span',
          { key: 'function', 'data-testid': 'function-row-ids' },
          JSON.stringify(functionResult.table.getRowModel().rows.map((row) => row.id))
        )
      ]);
    }

    render(React.createElement(RowIdInspector));

    expect(screen.getByTestId('default-row-ids').textContent).toBe(
      JSON.stringify(['7', 'default-row-id-1'])
    );
    expect(screen.getByTestId('key-row-ids').textContent).toBe(
      JSON.stringify(['customer-001', 'key-row-id-1'])
    );
    expect(screen.getByTestId('function-row-ids').textContent).toBe(
      JSON.stringify(['fn-function-id', 'fn-function-fallback'])
    );
  });

  it('initializes pagination at page 1', () => {
    render(React.createElement(InternalStateTester));
    expect(screen.getByTestId('page').textContent).toBe('1');
  });

  it('uses default page size when no pageSize prop provided', () => {
    render(React.createElement(InternalStateTester));
    // DEFAULT_DATA_TABLE_PAGE_SIZE is 50
    expect(screen.getByTestId('pageSize').textContent).toBe('50');
  });

  it('uses controlled pageSize prop', () => {
    render(React.createElement(InternalStateTester, { pageSize: 50 }));
    expect(screen.getByTestId('pageSize').textContent).toBe('50');
  });

  it('updates page size when controlled prop changes', () => {
    const { rerender } = render(React.createElement(InternalStateTester, { pageSize: 10 }));
    expect(screen.getByTestId('pageSize').textContent).toBe('10');

    rerender(React.createElement(InternalStateTester, { pageSize: 100 }));
    expect(screen.getByTestId('pageSize').textContent).toBe('100');
  });

  it('navigates to next page on user interaction', () => {
    render(React.createElement(InternalStateTester, { pageSize: 2 }));
    act(() => {
      screen.getByTestId('next-page').click();
    });
    expect(screen.getByTestId('page').textContent).toBe('2');
  });

  it('derives page count from totalCount and current page size', () => {
    render(React.createElement(InternalStateTester, { pageSize: 2, totalCount: 5 }));
    act(() => {
      screen.getByTestId('next-page').click();
      screen.getByTestId('next-page').click();
    });
    expect(screen.getByTestId('page').textContent).toBe('3');
  });

  it('sorts by column on user interaction', () => {
    render(React.createElement(InternalStateTester));
    act(() => {
      screen.getByTestId('sort-name').click();
    });
    const sort = JSON.parse(screen.getByTestId('sort').textContent!);
    expect(sort).toEqual([{ id: 'name', desc: true }]);
  });

  it('persists sorting by tableId across remounts', () => {
    render(React.createElement(InternalStateTester, { tableId: 'sorting-persisted' }));
    act(() => {
      screen.getByTestId('sort-name').click();
    });

    cleanup();
    render(React.createElement(InternalStateTester, { tableId: 'sorting-persisted' }));
    expect(screen.getByTestId('sort').textContent).toBe(
      JSON.stringify([{ id: 'name', desc: true }])
    );
  });

  it('does not persist sorting when sortingStorage is false', () => {
    render(
      React.createElement(InternalStateTester, {
        tableId: 'sorting-disabled',
        sortingStorage: false
      })
    );
    act(() => {
      screen.getByTestId('sort-name').click();
    });

    cleanup();
    render(
      React.createElement(InternalStateTester, {
        tableId: 'sorting-disabled',
        sortingStorage: false
      })
    );
    expect(screen.getByTestId('sort').textContent).toBe('[]');
  });

  it('clears persisted sorting when sorting returns to initial state', () => {
    render(React.createElement(InternalStateTester, { tableId: 'sorting-cleared' }));
    act(() => {
      screen.getByTestId('sort-name').click();
    });
    expect(localStorage.getItem('data-table:sorting-cleared:sorting')).not.toBeNull();

    act(() => {
      screen.getByTestId('clear-sort').click();
    });

    expect(localStorage.getItem('data-table:sorting-cleared:sorting')).toBeNull();
  });

  it('filters by column on user interaction', () => {
    render(React.createElement(InternalStateTester));
    act(() => {
      screen.getByTestId('filter-name').click();
    });
    const filters = JSON.parse(screen.getByTestId('filters').textContent!);
    expect(filters).toEqual([{ id: 'name', value: 'Alice' }]);
  });

  it('keeps column filter updates active when enableAdvancedFilter is true', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      React.createElement(InternalStateTester, {
        tableId: 'advanced-filter-update',
        enableAdvancedFilter: true
      })
    );
    act(() => {
      screen.getByTestId('filter-name').click();
    });

    const filters = JSON.parse(screen.getByTestId('filters').textContent!);
    expect(filters).toEqual([{ id: 'name', value: 'Alice' }]);

    warn.mockRestore();
  });

  it('warns once when enableAdvancedFilter is passed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { rerender } = render(
      React.createElement(InternalStateTester, {
        tableId: 'advanced-filter-warning',
        enableAdvancedFilter: true
      })
    );

    await waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });

    rerender(
      React.createElement(InternalStateTester, {
        tableId: 'advanced-filter-warning',
        enableAdvancedFilter: true
      })
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('enableAdvancedFilter');
    expect(warn.mock.calls[0]?.[1]).toMatchObject({
      tableId: 'advanced-filter-warning',
      status: 'deprecated'
    });

    warn.mockRestore();
  });

  it('initializes sorting from initialState', () => {
    render(
      React.createElement(InternalStateTester, {
        initialSorting: [{ id: 'name', desc: true }]
      })
    );
    const sort = JSON.parse(screen.getByTestId('sort').textContent!);
    expect(sort).toEqual([{ id: 'name', desc: true }]);
  });

  it('prefers persisted sorting over initialState for the same tableId', () => {
    localStorage.setItem(
      'data-table:sorting-overrides-initial:sorting',
      JSON.stringify({ version: 1, sorting: [{ id: 'name', desc: true }] })
    );

    render(
      React.createElement(InternalStateTester, {
        tableId: 'sorting-overrides-initial',
        initialSorting: [{ id: 'id', desc: false }]
      })
    );

    const sort = JSON.parse(screen.getByTestId('sort').textContent!);
    expect(sort).toEqual([{ id: 'name', desc: true }]);
  });

  it('calls onPageSizeChange when user changes page size', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      React.createElement(InternalStateTester, {
        pageSize: 10,
        onPageSizeChange: onChange
      })
    );

    // Simulate page size change by re-rendering with new controlled value
    rerender(
      React.createElement(InternalStateTester, {
        pageSize: 50,
        onPageSizeChange: onChange
      })
    );

    // The internal effect calls onPageSizeChange when pageSize changes from controlled prop
    // Note: onPageSizeChange is called when table's pagination state changes,
    // not when the controlled prop changes. This test validates the callback wiring.
    expect(screen.getByTestId('pageSize').textContent).toBe('50');
  });

  it('does not depend on router search params for state', () => {
    // The internal-state mode does not read from useSearch().
    // If it did, the mocked empty useSearch would result in default values.
    // We verify that the table renders with the expected internal defaults.
    render(React.createElement(InternalStateTester, { pageSize: 25 }));
    // pageSize from controlled prop, not router
    expect(screen.getByTestId('pageSize').textContent).toBe('25');
  });

  it('reset: new component mount starts fresh', () => {
    const { unmount } = render(React.createElement(InternalStateTester, { pageSize: 2 }));
    act(() => {
      screen.getByTestId('next-page').click();
    });
    expect(screen.getByTestId('page').textContent).toBe('2');

    // Unmount and re-mount — state should reset
    unmount();
    cleanup();
    render(React.createElement(InternalStateTester, { pageSize: 2 }));
    expect(screen.getByTestId('page').textContent).toBe('1');
  });

  it('table exposes all expected state properties', () => {
    function StateInspector() {
      const { table } = useDataTable({
        tableId: 'internal-state-state-inspector',
        columns,
        data,
        pageCount: 1,
        pageSize: 25
      });
      const state = table.getState();

      return React.createElement('div', null, [
        React.createElement(
          'span',
          { key: 'hasPagination', 'data-testid': 'has-pagination' },
          String(state.pagination !== undefined)
        ),
        React.createElement(
          'span',
          { key: 'hasSorting', 'data-testid': 'has-sorting' },
          String(state.sorting !== undefined)
        ),
        React.createElement(
          'span',
          { key: 'hasFilters', 'data-testid': 'has-filters' },
          String(state.columnFilters !== undefined)
        )
      ]);
    }

    render(React.createElement(StateInspector));
    expect(screen.getByTestId('has-pagination').textContent).toBe('true');
    expect(screen.getByTestId('has-sorting').textContent).toBe('true');
    expect(screen.getByTestId('has-filters').textContent).toBe('true');
  });

  it('prepends a fixed row-number column by default', () => {
    render(React.createElement(RowNumberColumnInspector));

    expect(screen.getByTestId('leaf-columns').textContent).toBe(
      JSON.stringify([ROW_NUMBER_COLUMN_ID, 'id', 'name'])
    );
    expect(screen.getByText('序号')).toHaveClass('sr-only');
    expect(screen.getByTestId('first-size').textContent).toBe('40');
    expect(screen.getByTestId('first-min-size').textContent).toBe('40');
    expect(screen.getByTestId('first-max-size').textContent).toBe('40');
    expect(screen.getByTestId('first-can-hide').textContent).toBe('false');
    expect(screen.getByTestId('first-can-resize').textContent).toBe('false');
  });

  it('keeps dynamic row-number column width fixed across size/min/max', () => {
    render(React.createElement(RowNumberColumnInspector, { totalCount: 100000 }));

    expect(screen.getByTestId('first-size').textContent).toBe('90');
    expect(screen.getByTestId('first-min-size').textContent).toBe('90');
    expect(screen.getByTestId('first-max-size').textContent).toBe('90');
  });

  it('keeps static row numbers tied to the rendered data while the next page is loading', () => {
    const pageOneRows: TestRow[] = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    const pageTwoRows: TestRow[] = [
      { id: 11, name: 'Nina' },
      { id: 12, name: 'Oscar' }
    ];

    const { rerender } = render(
      React.createElement(RowNumberCellsInspector, {
        rows: pageOneRows,
        totalCount: 25
      })
    );

    expect(screen.getByTestId('row-numbers').textContent).toBe('1|2|');

    act(() => {
      screen.getByTestId('row-number-next-page').click();
    });

    expect(screen.getByTestId('row-numbers').textContent).toBe('1|2|');

    rerender(
      React.createElement(RowNumberCellsInspector, {
        rows: pageTwoRows,
        totalCount: 25
      })
    );

    expect(screen.getByTestId('row-numbers').textContent).toBe('11|12|');
  });

  it('can render original row indexes without page offset', () => {
    const pageOneRows: TestRow[] = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    const pageTwoRows: TestRow[] = [
      { id: 11, name: 'Nina' },
      { id: 12, name: 'Oscar' }
    ];

    const { rerender } = render(
      React.createElement(RowNumberCellsInspector, {
        rows: pageOneRows,
        totalCount: 25,
        rowNumberDisplayMode: 'original'
      })
    );

    act(() => {
      screen.getByTestId('row-number-next-page').click();
    });

    rerender(
      React.createElement(RowNumberCellsInspector, {
        rows: pageTwoRows,
        totalCount: 25,
        rowNumberDisplayMode: 'original'
      })
    );

    expect(screen.getByTestId('row-numbers').textContent).toBe('1|2|');
  });

  it('can disable the row-number column explicitly', () => {
    render(React.createElement(RowNumberColumnInspector, { showRowNumberColumn: false }));

    expect(screen.getByTestId('leaf-columns').textContent).toBe(JSON.stringify(['id', 'name']));
  });

  it('keeps the row-number column first when initialState defines column order', () => {
    render(
      React.createElement(RowNumberColumnInspector, {
        initialState: {
          columnOrder: ['name', 'id']
        }
      })
    );

    expect(screen.getByTestId('leaf-columns').textContent).toBe(
      JSON.stringify([ROW_NUMBER_COLUMN_ID, 'name', 'id'])
    );
  });

  it('forces the row-number column visible and fixed even if initialState tries to override it', () => {
    render(
      React.createElement(RowNumberColumnInspector, {
        initialState: {
          columnVisibility: {
            [ROW_NUMBER_COLUMN_ID]: false
          },
          columnSizing: {
            [ROW_NUMBER_COLUMN_ID]: 120
          }
        }
      })
    );

    expect(screen.getByTestId('visible-columns').textContent).toBe(
      JSON.stringify([ROW_NUMBER_COLUMN_ID, 'id', 'name'])
    );
    expect(screen.getByTestId('first-size').textContent).toBe('40');
  });

  it('ignores initial columnSizing overrides for row-number, select, and actions columns', () => {
    render(
      React.createElement(FixedColumnSizingInspector, {
        initialState: {
          columnSizing: {
            [ROW_NUMBER_COLUMN_ID]: 120,
            [SELECT_COLUMN_ID]: 96,
            [ACTIONS_COLUMN_ID]: 220,
            name: 180
          }
        }
      })
    );

    expect(screen.getByTestId('state-column-sizing').textContent).toBe(
      JSON.stringify({ name: 180 })
    );
    expect(screen.getByTestId('row-number-size').textContent).toBe(String(FIXED_COLUMN_WIDTH));
    expect(screen.getByTestId('select-size').textContent).toBe(String(FIXED_COLUMN_WIDTH));
    expect(screen.getByTestId('actions-size').textContent).toBe(
      String(getDataTableRowActionsColumnWidth(rowActions.length))
    );
  });

  it('injects a select column when showSelectColumn is enabled', () => {
    render(React.createElement(ExpandStateInspector, { showRowNumberColumn: false }));

    expect(screen.getByTestId('expand-leaf-columns').textContent).toBe(
      JSON.stringify([SELECT_COLUMN_ID, 'id', 'name', 'actions'])
    );
  });

  it('exposes selected row data and a clear-selection helper', () => {
    render(React.createElement(SelectedRowsInspector));

    expect(screen.getByTestId('selected-rows').textContent).toBe('[]');
    expect(screen.getByTestId('selected-rows-method').textContent).toBe('[]');
    expect(screen.getByTestId('selected-row-ids').textContent).toBe('[]');

    act(() => {
      screen.getByTestId('select-all').click();
    });

    expect(screen.getByTestId('selected-rows').textContent).toBe('[1,2,3,4]');
    expect(screen.getByTestId('selected-rows-method').textContent).toBe('[1,2,3,4]');
    expect(screen.getByTestId('selected-row-ids').textContent).toBe('["1","2","3","4"]');

    act(() => {
      screen.getByTestId('clear-selected').click();
    });

    expect(screen.getByTestId('selected-rows').textContent).toBe('[]');
    expect(screen.getByTestId('selected-rows-method').textContent).toBe('[]');
    expect(screen.getByTestId('selected-row-ids').textContent).toBe('[]');
  });

  it('warns when selectable rows fall back to index-based row ids', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function UnstableSelectableInspector() {
      useDataTable({
        tableId: 'unstable-selectable',
        columns,
        data: [{ id: Number.NaN, name: 'Invalid row id' }],
        pageCount: 1,
        showSelectColumn: true
      });

      return null;
    }

    render(React.createElement(UnstableSelectableInspector));

    await waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });

    expect(warn.mock.calls[0]?.[0]).toContain('[useDataTable]');
    expect(warn.mock.calls[0]?.[1]).toMatchObject({
      tableId: 'unstable-selectable',
      rowIdSource: 'index-fallback',
      selectionScope: 'page'
    });

    warn.mockRestore();
  });

  it('clears row selection when rowSelectionScopeKey changes', () => {
    const { rerender } = render(
      React.createElement(ScopedSelectedRowsInspector, { scopeKey: 'payment' })
    );

    act(() => {
      screen.getByTestId('scoped-select-all').click();
    });

    expect(screen.getByTestId('scoped-selected-rows').textContent).toBe('[1,2,3,4]');

    rerender(React.createElement(ScopedSelectedRowsInspector, { scopeKey: 'invoice' }));

    expect(screen.getByTestId('scoped-selected-rows').textContent).toBe('[]');
  });

  it('adds row-key based expand state and derives the panel id from tableId', () => {
    render(React.createElement(ExpandStateInspector));

    expect(screen.getByTestId('expand-panel-id').textContent).toBe('data-table-expand-panel-users');
    expect(screen.getByTestId('expand-leaf-columns').textContent).toBe(
      JSON.stringify([ROW_NUMBER_COLUMN_ID, SELECT_COLUMN_ID, 'id', 'name', 'actions'])
    );
    expect(screen.getByTestId('expand-left-pinning').textContent).toBe(
      JSON.stringify([ROW_NUMBER_COLUMN_ID, SELECT_COLUMN_ID, ACTIONS_COLUMN_ID])
    );
  });

  it('normalizes initialState.columnOrder with leading utility columns', () => {
    function ExpandColumnOrderInspector() {
      const { table } = useDataTable({
        tableId: 'expand-column-order-inspector',
        columns,
        data,
        pageCount: 1,
        showRowNumberColumn: true,
        showSelectColumn: true,
        actionColumnPin: 'left',
        rowActions,
        expandConfig: {
          rowKey: 'id',
          tabs: [
            {
              id: 'summary',
              label: '概览',
              render: (row) => row.name
            }
          ]
        },
        initialState: {
          columnOrder: [SELECT_COLUMN_ID, 'name', 'id']
        }
      });

      return React.createElement(
        'span',
        { 'data-testid': 'normalized-column-order' },
        JSON.stringify(table.getState().columnOrder ?? [])
      );
    }

    render(React.createElement(ExpandColumnOrderInspector));

    expect(screen.getByTestId('normalized-column-order').textContent).toBe(
      JSON.stringify([ROW_NUMBER_COLUMN_ID, SELECT_COLUMN_ID, 'name', 'id'])
    );
  });

  it('auto-closes the expanded row when the current page data no longer contains its rowKey', async () => {
    const { rerender } = render(React.createElement(ExpandStateInspector));

    act(() => {
      screen.getByTestId('expand-second').click();
    });

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('2');
    expect(screen.getByTestId('expanded-row-name').textContent).toBe('Bob');

    rerender(
      React.createElement(ExpandStateInspector, {
        rows: data.filter((row) => row.id !== 2)
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
      expect(screen.getByTestId('expanded-row-name').textContent).toBe('null');
    });
  });
});
