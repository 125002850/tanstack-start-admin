import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableEditChangeEvent } from '@/types/data-table';

type Row = {
  id: number;
  plain: number | null;
  quantity: number;
  decimal: number | null;
  amount: number | null;
  rate: number | null;
  preciseRate: number | null;
  next: string;
};

const columnDsl = createDataTableColumnDsl<Row>();
const columns = [
  columnDsl.editableField('plain', '普通数值', {
    type: 'number',
    edit: { maxFractionDigits: 2 }
  }),
  columnDsl.editableField('quantity', '数量', {
    type: 'int',
    edit: { allowEmpty: false, maxFractionDigits: 2 }
  }),
  columnDsl.editableField('decimal', '小数', {
    type: 'decimal',
    edit: {
      min: 0,
      max: 0.3,
      step: 0.1,
      maxFractionDigits: 2,
      showStepperButtons: true
    }
  }),
  columnDsl.editableField('amount', '金额', {
    type: 'money',
    edit: {
      currency: 'CNY',
      maxFractionDigits: 2
    }
  }),
  columnDsl.editableField('rate', '比例', {
    type: 'percent',
    edit: {
      min: 0,
      max: 1,
      step: 0.0001,
      maxFractionDigits: 2
    }
  }),
  columnDsl.editableField('preciseRate', '高精度比例', {
    type: 'percent',
    edit: {
      maxFractionDigits: 2
    }
  }),
  columnDsl.editableField('next', '下一列', {
    type: 'text'
  })
];

const ROWS: Row[] = [
  {
    id: 1,
    plain: 12,
    quantity: 1,
    decimal: 0.2,
    amount: 1234.5,
    rate: 0.125,
    preciseRate: 0.123456,
    next: '下一项'
  }
];

function NumberTable({
  rows = ROWS,
  showTable = true,
  onChange = () => undefined
}: {
  rows?: Row[];
  showTable?: boolean;
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
}) {
  const { table } = useDataTable({
    tableId: 'editable-number-test',
    columns,
    data: rows,
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return showTable ? <DataTable table={table} virtualization={false} /> : null;
}

function getCell(columnId: keyof Row) {
  const cell = document.querySelector<HTMLTableCellElement>(
    `td[data-cell-column-id="${columnId}"]`
  );
  if (!cell) throw new Error(`cell ${columnId} missing`);
  return cell;
}

describe('DataTableEditableNumberCell', () => {
  afterEach(cleanup);

  it('keeps intermediate text raw, blocks invalid Enter, and commits normalized number text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <React.StrictMode>
        <NumberTable onChange={onChange} />
      </React.StrictMode>
    );

    const cell = getCell('plain');
    await user.dblClick(cell);
    const input = screen.getByRole('textbox', { name: '编辑普通数值' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('12');
    expect(input).toHaveAttribute('inputmode', 'decimal');

    await user.clear(input);
    await user.type(input, '-');
    expect(input).toHaveValue('-');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{Enter}');
    expect(cell).toHaveAttribute('data-cell-editing', 'true');
    expect(input).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, '1,234.50');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(cell).not.toHaveAttribute('data-cell-editing'));
    expect(cell).toHaveTextContent('1234.5');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'enter',
        changes: [
          {
            rowId: '1',
            field: 'plain',
            previousValue: 12,
            value: 1234.5
          }
        ]
      })
    );
  });

  it('rejects a non-zero int fraction instead of rounding it', async () => {
    const user = userEvent.setup();
    render(<NumberTable />);

    const cell = getCell('quantity');
    await user.dblClick(cell);
    const input = screen.getByRole('textbox', { name: '编辑数量' });
    await user.clear(input);
    await user.type(input, '2.20');
    expect(screen.getByRole('alert')).toHaveTextContent('请输入整数。');
    await user.keyboard('{Enter}');
    expect(cell).toHaveAttribute('data-cell-editing', 'true');

    await user.clear(input);
    await user.type(input, '2.00');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(cell).toHaveTextContent('2'));
  });

  it('steps with configured controls, handles floating precision, and ignores wheel input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberTable onChange={onChange} />);

    const cell = getCell('decimal');
    await user.dblClick(cell);
    const input = screen.getByRole('textbox', { name: '编辑小数' });
    expect(input).toHaveValue('0.2');

    fireEvent.wheel(input, { deltaY: -100 });
    expect(input).toHaveValue('0.2');
    const stepper = screen.getByRole('group', { name: '小数步进控件' });
    expect(stepper).toHaveAttribute('data-orientation', 'vertical');
    const [incrementButton, decrementButton] = within(stepper).getAllByRole('button');
    expect(incrementButton).toHaveAccessibleName('增加小数');
    expect(decrementButton).toHaveAccessibleName('减少小数');
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveValue('0.3');
    expect(incrementButton).toBeDisabled();

    await user.click(decrementButton!);
    expect(input).toHaveValue('0.2');
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(cell).not.toHaveAttribute('data-cell-editing'));
    expect(cell).toHaveTextContent('0.3');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('renders money adornments but rejects a foreign currency symbol', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberTable onChange={onChange} />);

    const cell = getCell('amount');
    expect(cell).toHaveTextContent('¥1,234.50');
    await user.dblClick(cell);
    const input = screen.getByRole('textbox', { name: '编辑金额' });
    expect(input).toHaveValue('1234.5');

    await user.clear(input);
    await user.type(input, '$2,000.50');
    expect(screen.getByRole('alert')).toHaveTextContent('输入的货币符号或代码与当前币种不一致。');

    await user.clear(input);
    await user.type(input, 'CNY 2,000.50');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(cell).toHaveTextContent('¥2,000.50'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changes: [expect.objectContaining({ field: 'amount', value: 2000.5 })]
      })
    );
  });

  it('edits percent as percentage points and exposes an existing over-precision value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberTable onChange={onChange} />);

    const rateCell = getCell('rate');
    expect(rateCell).toHaveTextContent('12.50%');
    await user.dblClick(rateCell);
    const rateInput = screen.getByRole('textbox', { name: '编辑比例' });
    expect(rateInput).toHaveValue('12.5');
    await user.clear(rateInput);
    await user.type(rateInput, '12.34%');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(rateCell).toHaveTextContent('12.34%'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changes: [expect.objectContaining({ field: 'rate', value: 0.1234 })]
      })
    );

    const preciseCell = getCell('preciseRate');
    await user.dblClick(preciseCell);
    const preciseInput = screen.getByRole('textbox', { name: '编辑高精度比例' });
    expect(preciseInput).toHaveValue('12.3456');
    expect(preciseInput).toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(preciseCell).not.toHaveAttribute('data-cell-editing'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('commits a valid numeric draft once when its virtualized anchor detaches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<NumberTable onChange={onChange} />);

    await user.dblClick(getCell('plain'));
    const input = screen.getByRole('textbox', { name: '编辑普通数值' });
    await user.clear(input);
    await user.type(input, '88.5');

    rerender(<NumberTable showTable={false} onChange={onChange} />);
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: '编辑普通数值' })).not.toBeInTheDocument()
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'virtualization-detach',
        changes: [expect.objectContaining({ field: 'plain', value: 88.5 })]
      })
    );

    rerender(<NumberTable showTable onChange={onChange} />);
    await waitFor(() => expect(getCell('plain')).toHaveTextContent('88.5'));
  });
});
