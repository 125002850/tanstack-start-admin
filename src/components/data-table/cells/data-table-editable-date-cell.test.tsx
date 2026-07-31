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
  effectiveDate: string | null;
  requiredDate: string;
  next: string;
};

const columnDsl = createDataTableColumnDsl<Row>();
const columns = [
  columnDsl.editableField('effectiveDate', '生效日期', {
    type: 'date',
    edit: {
      min: '2026-01-01',
      max: '2026-12-31',
      isDateUnavailable: (value) => value === '2026-07-31'
    }
  }),
  columnDsl.editableField('requiredDate', '必填日期', {
    type: 'date',
    edit: {
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
    effectiveDate: '2026-07-30',
    requiredDate: '2024-02-29',
    next: '下一项'
  }
];

function DateTable({
  rows = ROWS,
  showTable = true,
  onChange = () => undefined
}: {
  rows?: Row[];
  showTable?: boolean;
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
}) {
  const { table } = useDataTable({
    tableId: 'editable-date-test',
    columns,
    data: rows,
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return (
    <div data-slot='dialog-content' data-testid='date-overlay-host'>
      {showTable ? <DataTable table={table} virtualization={false} /> : null}
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

describe('DataTableEditableDateCell', () => {
  afterEach(cleanup);

  it('opens a full-width Calendar immediately without rendering a text input', async () => {
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <DateTable />
      </React.StrictMode>
    );

    const cell = getCell('effectiveDate');
    await user.dblClick(cell);
    const dialog = await screen.findByRole('dialog', { name: '生效日期日历' });
    const trigger = screen.getByRole('button', { name: '编辑生效日期' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('textbox', { name: '编辑生效日期' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('grid')).toHaveClass('w-full');
    expect(dialog.querySelector('[class*="grid-cols-7"]')).not.toBeNull();

    const selectedDay = dialog.querySelector<HTMLElement>('[data-day="2026-07-30"] button');
    expect(selectedDay).not.toBeNull();
    await waitFor(() => expect(selectedDay).toHaveFocus());
    expect(dialog.querySelectorAll('[data-day] button[tabindex="0"]')).toHaveLength(1);
    expect(cell).toHaveAttribute('data-cell-editing', 'true');
  });

  it('disables unavailable dates and immediately commits Calendar selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTable onChange={onChange} />);

    const cell = getCell('effectiveDate');
    await user.dblClick(cell);
    const dialog = await screen.findByRole('dialog', { name: '生效日期日历' });
    expect(screen.getByTestId('date-overlay-host')).toContainElement(dialog);
    const unavailableDay = dialog.querySelector<HTMLElement>('[data-day="2026-07-31"] button');
    expect(unavailableDay).toBeDisabled();

    const nextDay = dialog.querySelector<HTMLButtonElement>('[data-day="2026-08-01"] button');
    if (!nextDay) throw new Error('calendar day 2026-08-01 missing');
    await user.click(nextDay);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(cell).toHaveTextContent('2026-08-01');
    expect(cell).toHaveFocus();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'selection' }));
  });

  it('clears nullable dates explicitly and keeps required dates non-empty', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTable onChange={onChange} />);

    const optionalCell = getCell('effectiveDate');
    await user.dblClick(optionalCell);
    expect(await screen.findByRole('dialog', { name: '生效日期日历' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '清除生效日期' }));
    await waitFor(() => expect(optionalCell).toHaveTextContent('-'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changes: [expect.objectContaining({ field: 'effectiveDate', value: null })]
      })
    );

    const requiredCell = getCell('requiredDate');
    await user.dblClick(requiredCell);
    expect(await screen.findByRole('dialog', { name: '必填日期日历' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '清除必填日期' })).not.toBeInTheDocument();
    expect(requiredCell).toHaveAttribute('data-cell-editing', 'true');
  });

  it('cancels the whole session from Calendar Escape and restores cell focus', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTable onChange={onChange} />);

    const cell = getCell('effectiveDate');
    await user.dblClick(cell);
    const dialog = await screen.findByRole('dialog', { name: '生效日期日历' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(cell).toHaveTextContent('2026-07-30');
    expect(cell).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps popup pointer events isolated and moves to the next editable cell with Tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateTable onChange={onChange} />);

    const cell = getCell('effectiveDate');
    const nextCell = getCell('requiredDate');
    await user.dblClick(cell);
    const dialog = await screen.findByRole('dialog', { name: '生效日期日历' });
    fireEvent.pointerDown(dialog);
    fireEvent.wheel(dialog);
    expect(cell).toHaveAttribute('data-cell-editing', 'true');

    await user.keyboard('{Tab}');
    await waitFor(() => expect(nextCell).toHaveFocus());
    expect(cell).toHaveTextContent('2026-07-30');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reverts an unchanged Calendar session when its virtualized anchor detaches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<DateTable onChange={onChange} />);

    await user.dblClick(getCell('effectiveDate'));
    expect(await screen.findByRole('dialog', { name: '生效日期日历' })).toBeVisible();
    rerender(<DateTable showTable={false} onChange={onChange} />);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '生效日期日历' })).not.toBeInTheDocument()
    );
    expect(onChange).not.toHaveBeenCalled();

    rerender(<DateTable onChange={onChange} />);
    await waitFor(() => expect(getCell('effectiveDate')).toHaveTextContent('2026-07-30'));
  });
});
