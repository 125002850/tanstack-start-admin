import { act, renderHook } from '@testing-library/react';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { useDataTable } from '@/hooks/use-data-table';
import { createDataTableLocalSetFilterValue } from '@/hooks/use-data-table/use-data-table-local-filtering';
import {
  getPageSelectableRows,
  getPageSelectionTotalRowCount,
  getSelectedPageRowCount,
  getSelectedPageRowIds,
  getSelectedPageRows
} from './selection';

interface TestRow {
  id: string;
  name: string;
  selectable?: boolean;
  children?: TestRow[];
}

const rows: TestRow[] = [
  {
    id: 'parent',
    name: 'B',
    children: [
      { id: 'child', name: 'A' },
      { id: 'disabled-child', name: 'C', selectable: false }
    ]
  },
  { id: 'other', name: 'D' }
];

function useTestTable(data: TestRow[], tree = true) {
  return useReactTable({
    data,
    columns: [{ accessorKey: 'name' }],
    meta: tree ? { dataTableTree: { columnId: 'name' } } : undefined,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSubRowSelection: false,
    enableRowSelection: (row) => row.original.selectable !== false,
    manualPagination: true,
    initialState: {
      rowSelection: {
        parent: true,
        child: true,
        'disabled-child': true,
        'previous-page': true
      }
    }
  });
}

describe('树表本页选择范围', () => {
  it('折叠不改变已选节点、标识和数量，并排除不可选节点和其他页标识', () => {
    const { result } = renderHook(() => useTestTable(rows));

    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(['parent', 'other']);
    expect(getPageSelectableRows(result.current).map((row) => row.id)).toEqual([
      'parent',
      'child',
      'other'
    ]);
    expect(getSelectedPageRowIds(result.current)).toEqual(['parent', 'child']);
    expect(getSelectedPageRows(result.current)).toEqual([rows[0], rows[0]!.children![0]]);
    expect(getSelectedPageRowCount(result.current)).toBe(2);
    expect(getPageSelectionTotalRowCount(result.current)).toBe(3);

    act(() => result.current.getRow('parent').toggleExpanded(true));
    expect(result.current.getRowModel().rows).toHaveLength(4);
    expect(getSelectedPageRowIds(result.current)).toEqual(['parent', 'child']);

    act(() => result.current.getRow('parent').toggleExpanded(false));
    expect(getSelectedPageRowCount(result.current)).toBe(2);
    expect(getPageSelectionTotalRowCount(result.current)).toBe(3);
  });

  it('只返回当前筛选后保留的树节点，恢复数据后能重新读到保留的选择', () => {
    const { result, rerender } = renderHook(({ data }) => useTestTable(data), {
      initialProps: { data: rows }
    });

    rerender({ data: [rows[1]!] });
    expect(getPageSelectionTotalRowCount(result.current)).toBe(1);
    expect(getSelectedPageRows(result.current)).toEqual([]);
    expect(getSelectedPageRowIds(result.current)).toEqual([]);
    expect(getSelectedPageRowCount(result.current)).toBe(0);

    rerender({ data: rows });
    expect(getSelectedPageRowIds(result.current)).toEqual(['parent', 'child']);
  });

  it('未启用树模式时保留原有可见行统计语义', () => {
    const { result } = renderHook(() => useTestTable(rows, false));
    expect(getSelectedPageRowIds(result.current)).toEqual(['parent']);
    expect(getPageSelectionTotalRowCount(result.current)).toBe(2);

    act(() => result.current.getRow('parent').toggleExpanded(true));
    expect(getSelectedPageRowIds(result.current)).toEqual(['parent', 'child', 'disabled-child']);
    expect(getPageSelectionTotalRowCount(result.current)).toBe(4);
  });
});

describe('树表真实 hook 选择整合', () => {
  const columns = [{ accessorKey: 'name', meta: { localFilter: { variant: 'text' as const } } }];
  const getSubRows = (row: TestRow) => row.children;

  function useTreeTable() {
    return useDataTable({
      tableId: 'tree-selection-integration',
      data: rows,
      columns,
      rowId: 'id',
      tree: { columnId: 'name' },
      getSubRows,
      enableRowSelection: (row) => row.original.selectable !== false,
      columnResizeStorage: false,
      columnOrderStorage: false,
      sortingStorage: false,
      initialState: {
        rowSelection: { parent: true, child: true, 'disabled-child': true, 'previous-page': true }
      }
    });
  }

  it('排序和折叠后 hook 的业务行、ID、getter 与共享计数保持一致', () => {
    const { result } = renderHook(useTreeTable);
    act(() => result.current.table.setSorting([{ id: 'name', desc: true }]));

    expect(result.current.selectedRowIds).toEqual(['parent', 'child']);
    expect(result.current.selectedRows.map((row) => row.id)).toEqual(['parent', 'child']);
    expect(result.current.getSelectedRows()).toEqual(result.current.selectedRows);
    expect(getSelectedPageRowCount(result.current.table)).toBe(2);
    expect(getPageSelectionTotalRowCount(result.current.table)).toBe(3);

    act(() => result.current.table.toggleAllRowsExpanded(true));
    act(() => result.current.table.getRow('parent').toggleExpanded(false));
    expect(result.current.selectedRowIds).toEqual(['parent', 'child']);
    expect(result.current.table.getRowCount()).toBe(2);
    expect(result.current.table.getCoreRowModel().flatRows.map((row) => row.id)).toEqual([
      'parent',
      'child',
      'disabled-child',
      'other'
    ]);
  });

  it('真实树筛选投影与批量操作 getter 使用相同的保留节点集合', () => {
    const { result } = renderHook(useTreeTable);
    const filter = (value: string) => {
      act(() =>
        result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
          'name',
          createDataTableLocalSetFilterValue([`string:${value}`])
        )
      );
    };

    filter('C');
    expect(result.current.table.getCoreRowModel().flatRows.map((row) => row.id)).toEqual([
      'parent',
      'disabled-child'
    ]);
    expect(result.current.selectedRowIds).toEqual(['parent']);
    expect(result.current.getSelectedRows()).toEqual([rows[0]]);
    expect(getPageSelectionTotalRowCount(result.current.table)).toBe(1);

    filter('A');
    expect(result.current.selectedRowIds).toEqual(['parent', 'child']);
    expect(result.current.getSelectedRows()).toEqual([rows[0], rows[0]!.children![0]]);
    expect(getPageSelectionTotalRowCount(result.current.table)).toBe(2);

    act(() => result.current.table.options.meta!.dataTableLocalFiltering!.reset());
    expect(result.current.table.getState().expanded).toEqual({});
    expect(result.current.selectedRowIds).toEqual(['parent', 'child']);
    expect(getPageSelectionTotalRowCount(result.current.table)).toBe(3);
  });
});
