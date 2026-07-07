import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';

import { useDataTable } from '@/hooks/use-data-table';
import { saveDataTableColumnOrder } from '@/lib/data-table-state-persistence';

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
});
