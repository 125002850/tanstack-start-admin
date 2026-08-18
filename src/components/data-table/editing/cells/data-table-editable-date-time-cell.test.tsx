import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableEditChangeEvent } from '../types';

type Row = {
  id: number;
  executeAt: string | null;
  localStartsAt: string;
  next: string;
};

const columnDsl = createDataTableColumnDsl<Row>({
  tableId: 'editable-date-time-test',
  appTimeZone: 'Asia/Shanghai'
});
const columns = [
  columnDsl.editableField('executeAt', '执行时间', {
    type: 'dateTime',
    edit: {
      valueKind: 'instant',
      granularity: 'minute',
      step: 5,
      defaultTime: '09:30'
    }
  }),
  columnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: {
      valueKind: 'local',
      granularity: 'second',
      step: 15,
      allowEmpty: false
    }
  }),
  columnDsl.editableField('next', '下一列', {
    type: 'text'
  })
];

const ROWS: Row[] = [
  {
    id: 1,
    executeAt: '2026-07-30T04:05:00.000Z',
    localStartsAt: '2026-07-30T12:00:15',
    next: '下一项'
  }
];

function DateTimeTable({
  rows = ROWS,
  showTable = true,
  onChange = () => undefined
}: {
  rows?: Row[];
  showTable?: boolean;
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
}) {
  const { table } = useDataTable({
    tableId: 'editable-date-time-test',
    columns,
    data: rows,
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return (
    <div data-slot='dialog-content' data-testid='date-time-overlay-host'>
      {showTable ? <DataTable table={table} virtualization={false} /> : null}
      <button type='button'>外部目标</button>
    </div>
  );
}

function getCell(columnId: keyof Row) {
  const cell = document.querySelector<HTMLTableCellElement>(
    `td[data-cell-column-id="${columnId}"]`
  );
  if (!cell) throw new Error(`cell ${columnId} missing`);
  return cell;
}

describe('DataTableEditableDateTimeCell', () => {
  afterEach(cleanup);

  it('keeps Calendar selection in the draft until explicit confirmation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTimeTable onChange={onChange} />);

    const cell = getCell('executeAt');
    await user.dblClick(cell);
    const dialog = await screen.findByRole('dialog', { name: '执行时间日期时间编辑器' });
    const timeInput = screen.getByLabelText('执行时间：时间');
    expect(screen.getByTestId('date-time-overlay-host')).toContainElement(dialog);
    expect(dialog.querySelector('input[type="text"]')).not.toBeInTheDocument();
    expect(timeInput).toHaveValue('12:05');
    expect(dialog.querySelector('[data-day="2026-07-30"] button')).toHaveFocus();
    expect(screen.queryByText(/时区/)).not.toBeInTheDocument();

    fireEvent.change(timeInput, { target: { value: '12:10' } });
    const nextDay = dialog.querySelector<HTMLButtonElement>('[data-day="2026-08-01"] button');
    if (!nextDay) throw new Error('calendar day 2026-08-01 missing');
    await user.click(nextDay);

    expect(timeInput).toHaveValue('12:10');
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确定' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(cell).toHaveTextContent('2026-08-01 12:10:00');
    expect(cell).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'enter',
        changes: [
          expect.objectContaining({
            field: 'executeAt',
            value: '2026-08-01T04:10:00.000Z'
          })
        ]
      })
    );
  });

  it('uses defaultTime for the first empty Calendar selection without committing immediately', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTimeTable rows={[{ ...ROWS[0]!, executeAt: null }]} onChange={onChange} />);

    await user.dblClick(getCell('executeAt'));
    const dialog = await screen.findByRole('dialog', { name: '执行时间日期时间编辑器' });
    const availableDay = dialog.querySelector<HTMLButtonElement>(
      '[data-day] button:not(:disabled)'
    );
    if (!availableDay) throw new Error('available calendar day missing');
    const dateValue = availableDay.closest<HTMLElement>('[data-day]')?.dataset.day;
    if (!dateValue) throw new Error('calendar day value missing');
    await user.click(availableDay);

    expect(screen.getByLabelText('执行时间：时间')).toHaveValue('09:30');
    expect(dialog.querySelector('input[type="text"]')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks invalid second step values and confirms a canonical local value with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTimeTable onChange={onChange} />);

    const cell = getCell('localStartsAt');
    await user.dblClick(cell);
    const timeInput = screen.getByLabelText('本地开始时间：时间');
    fireEvent.change(timeInput, { target: { value: '12:00:01' } });
    expect(timeInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('按 15 秒递增');
    timeInput.focus();
    await user.keyboard('{Enter}');
    expect(cell).toHaveAttribute('data-cell-editing', 'true');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(timeInput, { target: { value: '12:00:30' } });
    timeInput.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(cell).not.toHaveAttribute('data-cell-editing'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changes: [expect.objectContaining({ value: '2026-07-30T12:00:30' })]
      })
    );
  });

  it('cancels on outside close and isolates popup pointer and wheel events', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTimeTable onChange={onChange} />);

    const cell = getCell('executeAt');
    await user.dblClick(cell);
    const dialog = await screen.findByRole('dialog', { name: '执行时间日期时间编辑器' });
    const timeInput = screen.getByLabelText('执行时间：时间');
    fireEvent.change(timeInput, { target: { value: '12:10' } });
    fireEvent.pointerDown(dialog);
    fireEvent.wheel(dialog);
    expect(cell).toHaveAttribute('data-cell-editing', 'true');

    await user.click(screen.getByRole('button', { name: '外部目标' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(cell).toHaveTextContent('2026-07-30 12:05:00');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reverts a valid explicit-confirm draft when virtualization detaches the anchor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<DateTimeTable onChange={onChange} />);

    await user.dblClick(getCell('executeAt'));
    const dialog = await screen.findByRole('dialog', { name: '执行时间日期时间编辑器' });
    fireEvent.change(screen.getByLabelText('执行时间：时间'), { target: { value: '12:10' } });
    const nextDay = dialog.querySelector<HTMLButtonElement>('[data-day="2026-08-01"] button');
    if (!nextDay) throw new Error('calendar day 2026-08-01 missing');
    await user.click(nextDay);
    rerender(<DateTimeTable showTable={false} onChange={onChange} />);

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: '执行时间日期时间编辑器' })
      ).not.toBeInTheDocument()
    );
    expect(onChange).not.toHaveBeenCalled();

    rerender(<DateTimeTable onChange={onChange} />);
    await waitFor(() => expect(getCell('executeAt')).toHaveTextContent('2026-07-30 12:05:00'));
  });
});
