import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDataTable } from '@/hooks/use-data-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';

type Item = { id: string; name: string };
const dsl = createDataTableColumnDsl<Item>();
const columns = [dsl.field('name', '名称')];
const data = [
  { id: 'b', name: '资源 B' },
  { id: 'a', name: '资源 A' }
];
const base = {
  tableId: 'detail-test',
  data,
  columns,
  rowId: 'id' as const,
  columnResizeStorage: false as const,
  columnOrderStorage: false as const,
  sortingStorage: false as const
};
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('详情不计入数据行、选择或分页；刷新保留展开，翻页清空', () => {
  const { result, rerender } = renderHook(
    ({ rows }) =>
      useDataTable({
        ...base,
        data: rows,
        pageSize: 1,
        rowDetail: { columnId: 'name', render: () => null }
      }),
    { initialProps: { rows: data } }
  );
  act(() => result.current.table.getRow('b').toggleExpanded(true));
  expect(result.current.table.getRowModel().rows.map((r) => r.id)).toEqual(['b', 'a']);
  expect(result.current.table.getPageCount()).toBe(2);
  act(() => result.current.table.getRow('b').toggleSelected(true));
  expect(result.current.getSelectedRows()).toHaveLength(1);
  rerender({ rows: [...data] });
  expect(result.current.table.getRow('b').getIsExpanded()).toBe(true);
  act(() => result.current.table.nextPage());
  expect(result.current.table.getState().expanded).toEqual({});
});

function Child() {
  const { table } = useDataTable({
    ...base,
    tableId: 'detail-child',
    data: [{ id: 'a', name: '张三' }]
  });
  return (
    <div className='h-80'>
      <DataTable table={table} showPagination={false} />
    </div>
  );
}
function Example() {
  const { table } = useDataTable({
    ...base,
    rowDetail: { columnId: 'name', render: () => <Child /> }
  });
  return (
    <DataTable
      table={table}
      virtualization={{
        mode: 'on',
        rowCountThreshold: 1,
        columnVirtualizationMode: 'on',
        columnCountThreshold: 1
      }}
    />
  );
}

it('按需挂载独立子表，主表不虚拟化，子表复制不会复制父表', () => {
  const view = render(<Example />);
  expect(screen.queryByText('张三')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '展开 资源 A' }));
  const detail = view.container.querySelector('[data-slot="data-table-row-detail"]')!;
  expect(within(detail as HTMLElement).getByText('张三')).toBeInTheDocument();
  expect(view.container.querySelector('[data-virtual-enabled="true"]')).toBeNull();
  const childCell = within(detail as HTMLElement)
    .getByText('张三')
    .closest('td')!;
  fireEvent.focus(screen.getByText('资源 B').closest('td')!);
  fireEvent.focus(childCell);
  const setData = vi.fn();
  fireEvent.copy(childCell, { clipboardData: { setData } });
  expect(setData).toHaveBeenCalledTimes(1);
  expect(setData).toHaveBeenCalledWith('text/plain', '张三');
  fireEvent.click(screen.getByRole('button', { name: '收起 资源 A' }));
  expect(screen.queryByText('张三')).toBeNull();
});
