import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';
import { useDataTable } from '@/hooks/use-data-table';

const columns = [{ accessorKey: 'id' }];

describe('受控表格选择', () => {
  it('本页全选和清空通过回调联动，翻页保留其他页选择且统计只计本页', () => {
    const { result, rerender } = renderHook(
      ({ data }) => {
        const [rowSelection, onRowSelectionChange] = useState<RowSelectionState>({});
        return useDataTable({
          tableId: 'controlled-selection',
          columns,
          data,
          rowId: 'id',
          rowSelection,
          onRowSelectionChange,
          showSelectColumn: true
        });
      },
      { initialProps: { data: [{ id: 'a' }, { id: 'b' }] } }
    );
    act(() => result.current.table.toggleAllPageRowsSelected(true));
    expect(result.current.selectedRowIds).toEqual(['a', 'b']);
    rerender({ data: [{ id: 'c' }] });
    expect(result.current.selectedRowIds).toEqual([]);
    act(() => result.current.table.toggleAllPageRowsSelected(true));
    act(() => result.current.table.toggleAllPageRowsSelected(false));
    expect(result.current.table.getState().rowSelection).toEqual({ a: true, b: true });
    rerender({ data: [{ id: 'a' }, { id: 'b' }] });
    expect(result.current.selectedRowIds).toEqual(['a', 'b']);
    act(() => result.current.clearSelectedRows());
    expect(result.current.selectedRowIds).toEqual([]);
  });

  it('外部确认前不改变受控状态，禁用时不能选择', () => {
    const selection: RowSelectionState = { a: true };
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useDataTable({
          tableId: 'controlled-selection-readonly',
          columns,
          data: [{ id: 'a' }],
          rowId: 'id',
          rowSelection: selection,
          enableRowSelection: enabled
        }),
      { initialProps: { enabled: true } }
    );
    act(() => result.current.table.getRow('a').toggleSelected(false));
    expect(result.current.table.getRow('a').getIsSelected()).toBe(true);
    rerender({ enabled: false });
    expect(result.current.table.getRow('a').getCanSelect()).toBe(false);
  });
});
