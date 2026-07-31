import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
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
    edit: { control: 'input', inputType: 'tel', inputMode: 'tel', allowEmpty: false }
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

const BLOCKING_COLUMNS = [
  {
    ...COLUMNS[0]!,
    meta: {
      ...COLUMNS[0]!.meta,
      editableCell: {
        ...COLUMNS[0]!.meta!.editableCell!,
        invalidEditBehavior: 'block' as const
      }
    }
  },
  COLUMNS[1]!
];

function EditableValueTable({
  onChange = () => undefined,
  blockInvalidPhone = false
}: {
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
  blockInvalidPhone?: boolean;
}) {
  const { table } = useDataTable({
    tableId: 'editable-value-test',
    columns: blockInvalidPhone ? BLOCKING_COLUMNS : COLUMNS,
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
      expect(onChange).toHaveBeenLastCalledWith({
        reason: 'enter',
        changes: [
          {
            rowId: '1',
            field: 'phone',
            previousValue: '13800000000',
            value: '13900000000'
          }
        ],
        snapshot: {
          rows: [{ id: 1, phone: '13900000000', status: 'ENABLED' }],
          changedRows: [{ id: 1, phone: '13900000000', status: 'ENABLED' }],
          changes: [
            {
              rowId: '1',
              field: 'phone',
              previousValue: '13800000000',
              value: '13900000000'
            }
          ],
          loadedPages: [1]
        }
      })
    );
  });

  it('starts text editing with Enter and F2, cancels with Escape, and commits with Tab or blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditableValueTable onChange={onChange} />);

    const phoneCell = getCell('phone');
    await user.click(phoneCell);
    fireEvent.keyDown(phoneCell, { key: 'Enter' });

    const enterInput = screen.getByRole('textbox', { name: '编辑手机号' });
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    await user.clear(enterInput);
    await user.type(enterInput, '13900000000');
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: '编辑手机号' })).not.toBeInTheDocument()
    );
    expect(phoneCell).toHaveTextContent('13800000000');
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(phoneCell, { key: 'F2' });
    const f2Input = screen.getByRole('textbox', { name: '编辑手机号' });
    await user.clear(f2Input);
    await user.type(f2Input, '13700000000');
    await user.keyboard('{Tab}');

    await waitFor(() => expect(phoneCell).toHaveTextContent('13700000000'));
    const statusCell = getCell('status');
    expect(statusCell).toHaveFocus();
    expect(statusCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'tab' }));

    await user.dblClick(phoneCell);
    const blurInput = screen.getByRole('textbox', { name: '编辑手机号' });
    fireEvent.change(blurInput, { target: { value: '13600000000' } });
    fireEvent.blur(blurInput);

    await waitFor(() => expect(phoneCell).toHaveTextContent('13600000000'));
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'blur' }));
  });

  it('keeps a blocked input editor focused and restores the initial value with Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditableValueTable onChange={onChange} blockInvalidPhone />);

    const phoneCell = getCell('phone');
    await user.dblClick(phoneCell);
    const input = screen.getByRole('textbox', { name: '编辑手机号' });
    await user.clear(input);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('');
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: '编辑手机号' })).not.toBeInTheDocument()
    );
    expect(phoneCell).toHaveTextContent('13800000000');
    expect(phoneCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(onChange).not.toHaveBeenCalled();
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
    expect(statusCell).not.toHaveAttribute('data-cell-editing');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
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
    expect(statusCell).not.toHaveAttribute('data-cell-editing');
    expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
