import { act, renderHook } from '@testing-library/react';
import type { ExpandedState } from '@tanstack/react-table';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { useDataTable } from '@/hooks/use-data-table';
import { createDataTableLocalSetFilterValue } from './use-data-table-local-filtering';
import type { UseDataTableProps } from './types';

interface TreeRow {
  id: string;
  name: string;
  children?: TreeRow[];
}

const dsl = createDataTableColumnDsl<TreeRow>();
const columns = [dsl.field('name', '名称', { localFilter: 'text' })];
const getSubRows = (row: TreeRow) => row.children;
const data: TreeRow[] = [
  {
    id: 'b',
    name: '资源 B',
    children: [
      { id: 'b2', name: '李四' },
      { id: 'b1', name: '王五', children: [{ id: 'b11', name: '客户' }] }
    ]
  },
  { id: 'a', name: '资源 A' }
];

function options(overrides: Partial<UseDataTableProps<TreeRow>> = {}): UseDataTableProps<TreeRow> {
  return {
    tableId: 'tree-contract',
    columns,
    data,
    rowId: 'id',
    getSubRows,
    tree: { columnId: 'name' },
    columnResizeStorage: false,
    columnOrderStorage: false,
    sortingStorage: false,
    ...overrides
  };
}

const visibleIds = (table: ReturnType<typeof useDataTable<TreeRow>>['table']) =>
  table.getRowModel().rows.map((row) => row.id);

describe('DataTable 树形行契约', () => {
  it('展开只影响可见行，父子共用模型，总数和页数按根节点计算', () => {
    const { result } = renderHook(() => useDataTable(options({ pageSize: 1 })));
    expect(visibleIds(result.current.table)).toEqual(['b', 'a']);
    expect(result.current.table.getRowCount()).toBe(2);
    expect(result.current.table.getPageCount()).toBe(2);
    act(() => result.current.table.toggleAllRowsExpanded(true));
    expect(visibleIds(result.current.table)).toEqual(['b', 'b2', 'b1', 'b11', 'a']);
    expect(result.current.table.getRow('b11').depth).toBe(2);
    expect(result.current.table.getRowCount()).toBe(2);
    expect(result.current.table.getPageCount()).toBe(2);
  });

  it('收起再展开保留后代展开状态，父行勾选不级联', () => {
    const { result } = renderHook(() => useDataTable(options()));
    act(() => result.current.table.setExpanded({ b: true, b1: true }));
    act(() => result.current.table.getRow('b').toggleExpanded(false));
    expect(visibleIds(result.current.table)).toEqual(['b', 'a']);
    act(() => result.current.table.getRow('b').toggleExpanded(true));
    expect(visibleIds(result.current.table)).toContain('b11');
    act(() => result.current.table.getRow('b').toggleSelected(true));
    expect(result.current.selectedRowIds).toEqual(['b']);
    expect(result.current.table.getState().rowSelection).toEqual({ b: true });
  });

  it('刷新和兄弟排序保持展开，排序不会将子行移出父节点', () => {
    const { result, rerender } = renderHook(
      ({ rows }) => useDataTable(options({ data: rows, initialState: { expanded: { b: true } } })),
      { initialProps: { rows: data } }
    );
    act(() => result.current.table.setSorting([{ id: 'name', desc: false }]));
    expect(visibleIds(result.current.table)[0]).toBe('a');
    expect(visibleIds(result.current.table).slice(1)).toEqual(['b', 'b2', 'b1']);
    rerender({ rows: structuredClone(data) });
    expect(result.current.table.getRow('b').getIsExpanded()).toBe(true);
    expect(visibleIds(result.current.table)).toHaveLength(4);
  });

  it('服务端排序保持传入的根与子顺序，显式总数始终表示根记录', () => {
    const { result } = renderHook(() =>
      useDataTable(
        options({
          sortingMode: 'server',
          totalCount: 120,
          pageSize: 20,
          initialState: { expanded: true, sorting: [{ id: 'name', desc: true }] }
        })
      )
    );
    expect(visibleIds(result.current.table)).toEqual(['b', 'b2', 'b1', 'b11', 'a']);
    expect(result.current.table.getRowCount()).toBe(120);
    expect(result.current.table.getPageCount()).toBe(6);
  });

  it('受控展开等待调用方更新，支持 updater 回调', () => {
    const onExpandedChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ expanded }: { expanded: ExpandedState }) =>
        useDataTable(options({ expanded, onExpandedChange })),
      { initialProps: { expanded: {} as ExpandedState } }
    );
    act(() => result.current.table.getRow('b').toggleExpanded(true));
    expect(visibleIds(result.current.table)).toEqual(['b', 'a']);
    const updater = onExpandedChange.mock.calls[0][0] as (state: ExpandedState) => ExpandedState;
    rerender({ expanded: updater({}) });
    expect(visibleIds(result.current.table)).toEqual(['b', 'b2', 'b1', 'a']);
  });

  it('本地筛选展示命中路径，允许收起，清除后还原筛选前展开状态', () => {
    const { result } = renderHook(() =>
      useDataTable(options({ initialState: { expanded: { b: true } } }))
    );
    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'name',
        createDataTableLocalSetFilterValue(['string:客户'])
      )
    );
    expect(visibleIds(result.current.table)).toEqual(['b', 'b1', 'b11']);
    act(() => result.current.table.getRow('b').toggleExpanded(false));
    expect(visibleIds(result.current.table)).toEqual(['b']);
    act(() => result.current.table.options.meta!.dataTableLocalFiltering!.reset());
    expect(result.current.table.getState().expanded).toEqual({ b: true });
    expect(visibleIds(result.current.table)).toEqual(['b', 'b2', 'b1', 'a']);
  });

  it('受控展开也通过回调接收筛选展开与还原', () => {
    const { result } = renderHook(() => {
      const [expanded, onExpandedChange] = useState<ExpandedState>({});
      return useDataTable(options({ expanded, onExpandedChange }));
    });
    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'name',
        createDataTableLocalSetFilterValue(['string:客户'])
      )
    );
    expect(visibleIds(result.current.table)).toEqual(['b', 'b1', 'b11']);
    act(() => result.current.table.options.meta!.dataTableLocalFiltering!.reset());
    expect(visibleIds(result.current.table)).toEqual(['b', 'a']);
  });

  it('翻页与服务端筛选重置展开，删除节点会清理对应展开 ID', () => {
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useDataTable(
          options({
            data: rows,
            totalCount: 100,
            pageSize: 20,
            initialState: { expanded: { b: true, b1: true } }
          })
        ),
      { initialProps: { rows: data } }
    );
    rerender({ rows: [data[1]] });
    expect(result.current.table.getState().expanded).toEqual({});
    rerender({ rows: data });
    act(() => result.current.table.toggleAllRowsExpanded(true));
    act(() => result.current.table.setPageIndex(1));
    expect(result.current.table.getState().expanded).toEqual({});
    act(() => result.current.table.toggleAllRowsExpanded(true));
    act(() => result.current.table.setColumnFilters([{ id: 'name', value: '资源' }]));
    expect(result.current.table.getState().expanded).toEqual({});
  });

  it('清空选择和切换选择范围只清除勾选，保留树展开状态', () => {
    const expanded = { b: true, b1: true };
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useDataTable(options({ rowSelectionScopeKey: scope, initialState: { expanded } })),
      { initialProps: { scope: 'selection-a' } }
    );
    act(() => result.current.table.getRow('b11').toggleSelected(true));
    expect(result.current.selectedRowIds).toEqual(['b11']);

    act(() => result.current.clearSelectedRows());
    expect(result.current.selectedRowIds).toEqual([]);
    expect(result.current.table.getState().expanded).toEqual(expanded);

    act(() => result.current.table.getRow('b11').toggleSelected(true));
    rerender({ scope: 'selection-b' });
    expect(result.current.selectedRowIds).toEqual([]);
    expect(result.current.table.getState().expanded).toEqual(expanded);
    expect(visibleIds(result.current.table)).toContain('b11');
  });

  it('切换选择范围不向受控展开状态发出重置请求', () => {
    const onExpandedChange = vi.fn();
    const expanded = { b: true, b1: true };
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useDataTable(options({ rowSelectionScopeKey: scope, expanded, onExpandedChange })),
      { initialProps: { scope: 'selection-a' } }
    );
    rerender({ scope: 'selection-b' });
    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(visibleIds(result.current.table)).toContain('b11');
  });

  it('异步初次空数组不会丢失默认展开，树列始终可见', () => {
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useDataTable(
          options({
            data: rows,
            initialState: {
              expanded: { b: true },
              columnVisibility: { name: false }
            }
          })
        ),
      { initialProps: { rows: [] as TreeRow[] } }
    );
    rerender({ rows: data });
    expect(result.current.table.getRow('b').getIsExpanded()).toBe(true);
    expect(result.current.table.getColumn('name')!.getCanHide()).toBe(false);
    act(() => result.current.table.setColumnVisibility({ name: false }));
    expect(result.current.table.getColumn('name')!.getIsVisible()).toBe(true);
  });

  it.each([
    ['缺少 children getter', { getSubRows: undefined }, /getSubRows is required/],
    ['错误树列', { tree: { columnId: 'missing' } }, /business leaf column/],
    [
      '重复行 ID',
      { data: [{ id: 'same', name: '父', children: [{ id: 'same', name: '子' }] }] },
      /unique/
    ],
    ['无稳定 ID', { data: [{ id: '', name: '无 ID' }] }, /stable rowId/],
    [
      '树单元格编辑',
      { columns: [dsl.editableField('name', '名称', { type: 'text' })] },
      /editing is not supported/
    ]
  ] as const)('明确拒绝%s', (_label, overrides, message) => {
    expect(() =>
      renderHook(() => useDataTable(options(overrides as Partial<UseDataTableProps<TreeRow>>)))
    ).toThrow(message);
  });

  it('在进入 TanStack 递归模型前拒绝循环树', () => {
    const cyclic: TreeRow = { id: 'cycle', name: '循环' };
    cyclic.children = [cyclic];
    expect(() => renderHook(() => useDataTable(options({ data: [cyclic] })))).toThrow(/cyclic/);
  });
});
