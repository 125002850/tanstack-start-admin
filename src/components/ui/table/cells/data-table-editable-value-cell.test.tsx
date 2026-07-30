import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableEditChangeEvent } from '@/types/data-table';

type Row = {
  id: number;
  phone: string;
  status: 'ENABLED' | 'DISABLED';
};

const columnDsl = createDataTableColumnDsl<Row>();
const COLUMNS = [
  columnDsl.editableField('phone', '手机号', {
    type: 'text',
    edit: { control: 'input', inputType: 'tel', inputMode: 'tel' }
  }),
  columnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [
      { value: 'ENABLED', label: '启用' },
      { value: 'DISABLED', label: '停用' }
    ],
    edit: {
      control: 'switch',
      checkedValue: 'ENABLED',
      uncheckedValue: 'DISABLED'
    }
  })
];

function EditableValueTable({
  onChange = () => undefined
}: {
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
}) {
  const { table } = useDataTable({
    tableId: 'editable-value-test',
    columns: COLUMNS,
    data: [{ id: 1, phone: '13800000000', status: 'ENABLED' }],
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return <DataTable table={table} virtualization={false} />;
}

function getCell(columnId: string) {
  return document.querySelector<HTMLTableCellElement>(`td[data-cell-column-id="${columnId}"]`)!;
}

describe('DataTable editable input and switch cells', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.setPointerCapture ??= vi.fn();
    Element.prototype.releasePointerCapture ??= vi.fn();
  });

  it('edits text in place and commits with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditableValueTable onChange={onChange} />);

    const phoneCell = getCell('phone');
    await user.click(phoneCell);
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(phoneCell).not.toHaveAttribute('data-cell-edit-ready');

    await user.dblClick(phoneCell);
    const input = screen.getByRole('textbox', { name: '编辑手机号' }) as HTMLInputElement;
    expect(input).toHaveClass('border-2', 'ring-[3px]', 'ring-primary/25');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputmode', 'tel');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('13800000000');
    expect(input.selectionStart).toBe(11);
    expect(input.selectionEnd).toBe(11);

    await user.clear(input);
    await user.type(input, '13900000000');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(phoneCell).toHaveTextContent('13900000000'));
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(phoneCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(phoneCell).not.toHaveAttribute('data-cell-editing');
    expect(screen.queryByRole('textbox', { name: '编辑手机号' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          reason: 'enter',
          changes: [
            {
              rowId: '1',
              field: 'phone',
              previousValue: '13800000000',
              value: '13900000000'
            }
          ]
        })
      )
    );
  });

  it('commits a switch directly and toggles it from the selected cell with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditableValueTable onChange={onChange} />);

    const statusCell = getCell('status');
    const statusSwitch = screen.getByRole('switch', { name: '状态：启用' });
    expect(statusSwitch).toBeChecked();

    await user.click(statusSwitch);
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: '状态：停用' })).not.toBeChecked()
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'selection',
        changes: [
          {
            rowId: '1',
            field: 'status',
            previousValue: 'ENABLED',
            value: 'DISABLED'
          }
        ]
      })
    );

    await user.click(statusCell);
    expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
    fireEvent.keyDown(statusCell, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('switch', { name: '状态：启用' })).toBeChecked());
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
