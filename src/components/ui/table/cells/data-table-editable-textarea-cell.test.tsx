import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableEditChangeEvent } from '@/types/data-table';

type Row = {
  id: number;
  remark: string;
  next: string;
};

const columnDsl = createDataTableColumnDsl<Row>();
const columns = [
  columnDsl.editableField('remark', '备注', {
    type: 'longText',
    edit: {
      control: 'textarea',
      allowEmpty: false,
      minLength: 2,
      maxLength: 12,
      rows: 4
    }
  }),
  columnDsl.editableField('next', '下一列', {
    type: 'text'
  })
];
const ROWS: Row[] = [{ id: 1, remark: '原始备注', next: '下一项' }];

function TextareaTable({
  rows = ROWS,
  showTable = true,
  onChange = () => undefined
}: {
  rows?: Row[];
  showTable?: boolean;
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
}) {
  const { table } = useDataTable({
    tableId: 'editable-textarea-test',
    columns,
    data: rows,
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return (
    <div data-slot='dialog-content' data-testid='overlay-host'>
      {showTable ? <DataTable table={table} virtualization={false} /> : null}
    </div>
  );
}

function getCell(columnId: string) {
  const cell = document.querySelector<HTMLTableCellElement>(
    `td[data-cell-column-id="${columnId}"]`
  );
  if (!cell) throw new Error(`cell ${columnId} missing`);
  return cell;
}

describe('DataTableEditableTextareaCell', () => {
  afterEach(cleanup);

  it('keeps Enter as a newline and commits with Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <React.StrictMode>
        <TextareaTable onChange={onChange} />
      </React.StrictMode>
    );

    const remarkCell = getCell('remark');
    await user.dblClick(remarkCell);
    const textarea = await screen.findByRole('textbox', { name: '编辑备注' });

    expect(textarea).toHaveFocus();
    const popup = screen.getByRole('dialog', { name: '备注多行文本编辑器' });
    expect(popup).toHaveTextContent('4 / 12');
    expect(screen.getByTestId('overlay-host')).toContainElement(popup);

    await user.type(textarea, '{Enter}第二行');
    expect(textarea).toHaveValue('原始备注\n第二行');
    expect(remarkCell).toHaveAttribute('data-cell-editing', 'true');
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(remarkCell).not.toHaveAttribute('data-cell-editing'));
    expect(remarkCell).toHaveTextContent('原始备注');
    expect(remarkCell).toHaveTextContent('第二行');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'enter',
        changes: [
          {
            rowId: '1',
            field: 'remark',
            previousValue: '原始备注',
            value: '原始备注\n第二行'
          }
        ]
      })
    );
  });

  it('shows validation errors, limits input length, and keeps a blocked submit open', async () => {
    const user = userEvent.setup();
    render(<TextareaTable />);

    await user.dblClick(getCell('remark'));
    const textarea = await screen.findByRole('textbox', { name: '编辑备注' });
    await user.clear(textarea);
    await user.type(textarea, 'a');

    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription(
      'Enter 换行，Ctrl/Cmd + Enter 提交 文本至少需要 2 个字符。'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('文本至少需要 2 个字符。');

    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(getCell('remark')).toHaveAttribute('data-cell-editing', 'true');
    expect(textarea).toHaveFocus();

    await user.clear(textarea);
    await user.type(textarea, '123456789012345');
    expect(textarea).toHaveValue('123456789012');
    expect(screen.getByRole('dialog', { name: '备注多行文本编辑器' })).toHaveTextContent('12 / 12');
  });

  it('commits from the explicit confirmation action', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextareaTable onChange={onChange} />);

    const remarkCell = getCell('remark');
    await user.dblClick(remarkCell);
    const textarea = await screen.findByRole('textbox', { name: '编辑备注' });
    await user.clear(textarea);
    await user.type(textarea, '按钮确认');
    await user.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(remarkCell).not.toHaveAttribute('data-cell-editing'));
    expect(remarkCell).toHaveTextContent('按钮确认');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('commits with Tab, navigates, and cancels the next session with Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextareaTable onChange={onChange} />);

    const remarkCell = getCell('remark');
    const nextCell = getCell('next');
    await user.dblClick(remarkCell);
    const textarea = await screen.findByRole('textbox', { name: '编辑备注' });
    await user.clear(textarea);
    await user.type(textarea, 'Tab 提交');
    await user.keyboard('{Tab}');

    await waitFor(() => expect(nextCell).toHaveFocus());
    expect(remarkCell).toHaveTextContent('Tab 提交');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'tab' }));

    await user.dblClick(remarkCell);
    const reopened = await screen.findByRole('textbox', { name: '编辑备注' });
    await user.clear(reopened);
    await user.type(reopened, '不应保存');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(remarkCell).not.toHaveAttribute('data-cell-editing'));
    expect(remarkCell).toHaveTextContent('Tab 提交');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('reverts an explicit-confirm draft when its row anchor detaches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TextareaTable onChange={onChange} />);

    await user.dblClick(getCell('remark'));
    const textarea = await screen.findByRole('textbox', { name: '编辑备注' });
    await user.clear(textarea);
    await user.type(textarea, '虚拟卸载不得提交');

    rerender(<TextareaTable showTable={false} onChange={onChange} />);
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: '编辑备注' })).not.toBeInTheDocument()
    );
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();

    rerender(<TextareaTable showTable onChange={onChange} />);
    await waitFor(() => expect(getCell('remark')).toHaveTextContent('原始备注'));
  });
});
