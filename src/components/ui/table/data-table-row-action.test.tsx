import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import {
  DataTableRowActions,
  type DataTableRowAction
} from '@/components/ui/table/data-table-row-action';

type TestRow = {
  id: number;
  name: string;
};

const ROW: TestRow = {
  id: 1,
  name: 'Alice'
};

afterEach(cleanup);

describe('DataTableRowActions', () => {
  it('opens a confirmation dialog before running delete actions', async () => {
    const onDelete = vi.fn();
    const actions: DataTableRowAction<TestRow>[] = [
      {
        label: '删除',
        icon: <span>delete</span>,
        confirmDelete: {
          title: '确认删除用户？',
          description: (row) => `确定要删除 ${row.name} 吗？`,
          confirmText: '确认删除',
          cancelText: '再想想'
        },
        onClick: onDelete
      }
    ];

    render(<DataTableRowActions row={ROW} actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(await screen.findByText('确认删除用户？')).toBeInTheDocument();
    expect(screen.getByText('确定要删除 Alice 吗？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(ROW);
    });
  });
});
