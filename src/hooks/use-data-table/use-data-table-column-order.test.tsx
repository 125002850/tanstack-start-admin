import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';

import { saveDataTableColumnOrder } from '@/lib/data-table/state-persistence';

import { DATA_TABLE_ROW_NUMBER_COLUMN_ID } from './constants';
import { useDataTable } from './use-data-table';

type TestRow = { id: number; name: string };

const TABLE_ID = 'column-order-table';
const STORAGE_KEY = `data-table:${TABLE_ID}:column-order`;
const data: TestRow[] = [{ id: 1, name: 'Alice' }];
const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];

function ColumnOrderInspector() {
  const { table } = useDataTable({
    tableId: TABLE_ID,
    data,
    columns,
    pageCount: 1,
    showRowNumberColumn: false
  });

  const columnOrderMeta = table.options.meta?.dataTableColumnOrder;

  return (
    <div>
      <span data-testid='leaf-columns'>
        {JSON.stringify(table.getAllLeafColumns().map((column) => column.id))}
      </span>
      <span data-testid='state-column-order'>{JSON.stringify(table.getState().columnOrder)}</span>
      <span data-testid='has-custom-order'>{String(columnOrderMeta?.hasCustomOrder ?? false)}</span>
      <button type='button' onClick={() => table.setColumnOrder(['name', 'id'])}>
        reorder
      </button>
      <button type='button' onClick={() => columnOrderMeta?.reset()}>
        reset
      </button>
    </div>
  );
}

type ExtendedRow = { id: number; name: string; price: number };

const extendedData: ExtendedRow[] = [{ id: 1, name: 'Alice', price: 10 }];
/** `name` 模拟缓存写入之后才新增的列：声明在 `id` 与 `price` 之间。 */
const extendedColumns: ColumnDef<ExtendedRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'price', header: 'Price' }
];

function ExtendedColumnsInspector({
  showRowNumberColumn = false
}: {
  showRowNumberColumn?: boolean;
}) {
  const { table } = useDataTable({
    tableId: TABLE_ID,
    data: extendedData,
    columns: extendedColumns,
    pageCount: 1,
    showRowNumberColumn
  });

  return (
    <span data-testid='leaf-columns'>
      {JSON.stringify(table.getAllLeafColumns().map((column) => column.id))}
    </span>
  );
}

describe('useDataTable column order persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(cleanup);

  it('hydrates column order from localStorage', () => {
    saveDataTableColumnOrder(TABLE_ID, ['name', 'id'], 'localStorage');

    render(<ColumnOrderInspector />);

    expect(screen.getByTestId('leaf-columns').textContent).toBe(JSON.stringify(['name', 'id']));
    expect(screen.getByTestId('state-column-order').textContent).toBe(
      JSON.stringify(['name', 'id'])
    );
    expect(screen.getByTestId('has-custom-order').textContent).toBe('true');
  });

  it('persists table.setColumnOrder and reset clears only the order cache', () => {
    render(<ColumnOrderInspector />);

    act(() => {
      screen.getByRole('button', { name: 'reorder' }).click();
    });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).order).toEqual(['name', 'id']);
    expect(screen.getByTestId('leaf-columns').textContent).toBe(JSON.stringify(['name', 'id']));
    expect(screen.getByTestId('has-custom-order').textContent).toBe('true');

    act(() => {
      screen.getByRole('button', { name: 'reset' }).click();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('leaf-columns').textContent).toBe(JSON.stringify(['id', 'name']));
    expect(screen.getByTestId('has-custom-order').textContent).toBe('false');
  });

  it('把缓存顺序里缺失的新增列回填到声明位置', () => {
    // 缓存是 `name` 列出现之前写入的完整顺序；TanStack 自身会把缺失列追加到末尾。
    saveDataTableColumnOrder(TABLE_ID, ['id', 'price'], 'localStorage');

    render(<ExtendedColumnsInspector />);

    expect(screen.getByTestId('leaf-columns').textContent).toBe(
      JSON.stringify(['id', 'name', 'price'])
    );
  });

  it('回填新增列时保持用户自定义的列顺序', () => {
    saveDataTableColumnOrder(TABLE_ID, ['price', 'id'], 'localStorage');

    render(<ExtendedColumnsInspector />);

    // 用户把 `id` 放到了最后，新增的 `name` 跟随其声明前驱 `id` 插入到它之后。
    expect(screen.getByTestId('leaf-columns').textContent).toBe(
      JSON.stringify(['price', 'id', 'name'])
    );
  });

  it('缓存缺少工具列时按声明的固定位置回填', () => {
    saveDataTableColumnOrder(TABLE_ID, ['name', 'id'], 'localStorage');

    render(<ExtendedColumnsInspector showRowNumberColumn />);

    // 序号列声明在业务列之前，回填后仍由 normalizeGeneratedColumnOrder 收敛到最前；
    // `price` 跟随其声明前驱 `name` 插入，缓存中已有的 `name`/`id` 顺序不变。
    expect(screen.getByTestId('leaf-columns').textContent).toBe(
      JSON.stringify([DATA_TABLE_ROW_NUMBER_COLUMN_ID, 'name', 'price', 'id'])
    );
  });
});
