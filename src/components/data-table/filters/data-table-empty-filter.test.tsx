import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState
} from '@tanstack/react-table';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '../columns/data-table-column-factory';
import { DataTableToolbar } from '../toolbar/data-table-toolbar';
import { buildDataTableDslRequest } from '@/hooks/use-data-table/dsl';
import type { DataTableRemoteFilterOptions } from './types';

type RecordRow = { category: string | null };
const dsl = createDataTableColumnDsl<RecordRow>();
const choices = [
  { value: 'A', label: '分类 A' },
  { value: 'B', label: '分类 B' }
];

function Harness({ columns }: { columns: ColumnDef<RecordRow>[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useReactTable({
    data: [],
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true
  });
  const request = buildDataTableDslRequest({
    columns,
    columnFilters,
    pagination: { pageIndex: 0, pageSize: 20 },
    sorting: []
  });
  return (
    <>
      <DataTableToolbar table={table} />
      <output aria-label='查询条件'>{JSON.stringify(request.condition ?? null)}</output>
    </>
  );
}

function mount(columns: ColumnDef<RecordRow>[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness columns={columns} />
    </QueryClientProvider>
  );
}

function condition() {
  return JSON.parse(screen.getByLabelText('查询条件').textContent!);
}

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();
  Element.prototype.scrollIntoView ??= vi.fn();
});
afterEach(cleanup);

describe('DataTable empty search option', () => {
  it.each(['select', 'multiSelect', 'remoteSelect'] as const)(
    '%s keeps empty filtering opt-in',
    async (filter) => {
      const user = userEvent.setup();
      mount([
        dsl.field('category', '分类', {
          filter,
          filterOptions: choices,
          filterRemoteOptions: { loadOptions: async () => ({ items: choices }) }
        })
      ]);
      await user.click(screen.getByRole('button', { name: '分类' }));
      await screen.findByRole('option', { name: '分类 A' });
      expect(screen.queryByRole('option', { name: '空值' })).not.toBeInTheDocument();
    }
  );

  it.each(['select', 'multiSelect'] as const)(
    '%s puts NULL first, displays its label and clears to no condition',
    async (filter) => {
      const user = userEvent.setup();
      mount([
        dsl.field('category', '分类', { filter, filterOptions: choices, filterEmptyOption: {} })
      ]);
      await user.click(screen.getByRole('button', { name: '分类' }));
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('空值');
      await user.click(screen.getByRole('option', { name: '空值' }));
      expect(condition()).toEqual({
        nodeType: 'compose',
        logic: 'AND',
        children: [{ nodeType: 'text', field: 'category', op: 'IS_NULL' }]
      });
      expect(screen.getByRole('button', { name: '分类' })).toHaveTextContent('空值');
      if (filter === 'select') await user.click(screen.getByRole('button', { name: '分类' }));
      await user.click(screen.getByRole('option', { name: '清除筛选' }));
      expect(condition()).toBeNull();
    }
  );

  it('combines NULL and ordinary choices and returns to ordinary filtering on deselection', async () => {
    const user = userEvent.setup();
    mount([
      dsl.field('category', '分类', {
        filter: 'multiSelect',
        filterOptions: choices,
        filterEmptyOption: { label: '未设置' }
      })
    ]);
    await user.click(screen.getByRole('button', { name: '分类' }));
    await user.click(screen.getByRole('option', { name: '未设置' }));
    await user.click(screen.getByRole('option', { name: '分类 A' }));
    expect(condition()).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'compose',
          logic: 'OR',
          children: [
            { nodeType: 'text', field: 'category', op: 'IN', values: ['A'] },
            { nodeType: 'text', field: 'category', op: 'IS_NULL' }
          ]
        }
      ]
    });
    await user.click(screen.getByRole('option', { name: '未设置' }));
    expect(condition().children).toEqual([
      { nodeType: 'text', field: 'category', op: 'IN', values: ['A'] }
    ]);
  });

  it('keeps NULL independent of tree cascade selections', async () => {
    const user = userEvent.setup();
    mount([
      dsl.field('category', '分类', {
        filter: 'multiSelect',
        filterEmptyOption: {},
        filterOptions: {
          kind: 'tree',
          options: [
            { value: 'root', label: '总类', depth: 0 },
            { value: 'A', label: '分类 A', depth: 1 }
          ]
        }
      })
    ]);
    await user.click(screen.getByRole('button', { name: '分类' }));
    expect(screen.getAllByRole('treeitem')[0]).toHaveTextContent('空值');
    await user.click(screen.getByRole('treeitem', { name: '空值，未选中' }));
    expect(condition().children).toEqual([{ nodeType: 'text', field: 'category', op: 'IS_NULL' }]);
    await user.click(screen.getByRole('treeitem', { name: '总类，未选中' }));
    expect(condition().children[0].children).toEqual([
      { nodeType: 'text', field: 'category', op: 'IN', values: ['root', 'A'] },
      { nodeType: 'text', field: 'category', op: 'IS_NULL' }
    ]);
  });

  it.each(['remoteSelect', 'multiSelect'] as const)(
    'remote %s keeps NULL first across pages, search and reopening',
    async (filter) => {
      const user = userEvent.setup();
      const loadOptions = vi.fn<DataTableRemoteFilterOptions['loadOptions']>(
        async ({ keyword, pageNo }) => ({
          items: keyword ? [] : [choices[pageNo - 1]],
          total: keyword ? 0 : 2
        })
      );
      mount([
        dsl.field('category', '分类', {
          filter,
          filterEmptyOption: { label: '未绑定' },
          filterRemoteOptions: { loadOptions, pageSize: 1, debounceMs: 0 }
        })
      ]);
      await user.click(screen.getByRole('button', { name: '分类' }));
      await screen.findByRole('option', { name: '分类 A' });
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('未绑定');
      const list = screen.getByRole('listbox');
      Object.defineProperties(list, {
        clientHeight: { configurable: true, value: 120 },
        scrollHeight: { configurable: true, value: 300 },
        scrollTop: { configurable: true, value: 140, writable: true }
      });
      fireEvent.wheel(list, { deltaY: 200 });
      fireEvent.scroll(list);
      await screen.findByRole('option', { name: '分类 B' });
      expect(loadOptions).toHaveBeenLastCalledWith({
        keyword: '',
        pageNo: 2,
        pageSize: 1,
        signal: expect.any(AbortSignal)
      });
      expect(screen.getAllByRole('option', { name: '未绑定' })).toHaveLength(1);
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('未绑定');

      await user.click(screen.getByRole('option', { name: '未绑定' }));
      if (filter === 'multiSelect') {
        await user.click(screen.getByRole('option', { name: '分类 A' }));
        expect(condition().children[0].logic).toBe('OR');
        await user.keyboard('{Escape}');
      }
      expect(screen.getByRole('button', { name: '分类' })).toHaveTextContent('未绑定');
      await user.click(screen.getByRole('button', { name: '分类' }));
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('未绑定');
      await user.type(screen.getByRole('combobox'), '不存在');
      await waitFor(() =>
        expect(loadOptions).toHaveBeenLastCalledWith({
          keyword: '不存在',
          pageNo: 1,
          pageSize: 1,
          signal: expect.any(AbortSignal)
        })
      );
      expect(screen.getAllByRole('option', { name: '未绑定' })).toHaveLength(1);
      await user.click(screen.getByRole('option', { name: '清除筛选' }));
      expect(condition()).toBeNull();
    }
  );
});
