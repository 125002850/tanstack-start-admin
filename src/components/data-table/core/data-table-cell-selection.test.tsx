import {
  EditableSelectionHarness,
  EditableNumericSelectionHarness,
  KeyboardSelectionHarness,
  Harness,
  MoneyCopyHarness,
  SelectableHarness,
  SpecialColumnsSelectionHarness,
  WideHarness,
  makeRows,
  makeWideRows,
  createCopyEvent,
  createPasteEvent,
  dispatchCellPointerEvent,
  dragCellRange,
  getBodyCell,
  type EditableRow
} from './data-table.test-utils';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DataTableEditingController } from '@/types/data-table';

describe('DataTable cell selection', () => {
  it('renders a server cell error with accessible invalid state and a non-color marker', async () => {
    const user = userEvent.setup();
    const editingRef: { current: DataTableEditingController<EditableRow> | null } = {
      current: null
    };
    const { container } = render(
      <EditableSelectionHarness
        onChange={vi.fn()}
        onEditingReady={(controller) => {
          editingRef.current = controller;
        }}
      />
    );
    await waitFor(() => expect(editingRef.current).not.toBeNull());
    const editing = editingRef.current;
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const statusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="status"]'
    );
    if (!nameCell || !statusCell || !editing) throw new Error('server error cells missing');

    let mutationResult: ReturnType<typeof editing.setServerCellErrors> | undefined;
    act(() => {
      mutationResult = editing.setServerCellErrors({
        revision: editing.getRevision(),
        errors: [{ rowId: '1', field: 'name', messages: ['名称已存在'] }]
      });
    });

    expect(mutationResult).toEqual({ applied: 1, skipped: 0 });
    expect(editing.getServerCellErrors()).toEqual([
      expect.objectContaining({ rowId: '1', field: 'name', messages: ['名称已存在'] })
    ]);
    await waitFor(() => expect(nameCell).toHaveAttribute('aria-invalid', 'true'));
    expect(nameCell).toHaveAttribute('data-cell-server-invalid', 'true');
    const descriptionId = nameCell.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent('名称已存在');
    expect(
      nameCell.querySelector('[data-slot="data-table-cell-server-error-marker"]')
    ).toHaveTextContent('!');
    expect(statusCell).not.toHaveAttribute('aria-invalid');
    expect(editing.getSnapshot().changes).toEqual([]);

    await user.dblClick(nameCell);
    const input = screen.getByRole('textbox', { name: '编辑名称' });
    expect(nameCell).toHaveAttribute('data-cell-server-invalid', 'true');
    expect(document.getElementById(descriptionId!)).toHaveTextContent('名称已存在');
    await user.clear(input);
    await user.type(input, '修正名称{Enter}');

    await waitFor(() => expect(nameCell).not.toHaveAttribute('data-cell-server-invalid'));
    expect(document.getElementById(descriptionId!)).toBeNull();
  });

  it('does not run table hotkeys for composing or already-consumed events', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditableSelectionHarness onChange={vi.fn()} />);
    const firstCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="status"]'
    );
    if (!firstCell) throw new Error('editable cell missing');

    await user.click(firstCell);
    fireEvent.keyDown(firstCell, { key: 'Enter', isComposing: true });

    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    const consumedEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    consumedEvent.preventDefault();
    fireEvent(firstCell, consumedEvent);

    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    fireEvent.keyDown(firstCell, { key: 'Enter' });
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(await screen.findByRole('option', { name: '就绪' })).toBeInTheDocument();
  });

  it.each([
    { label: 'ASCII', key: 'a', composingKey: undefined },
    { label: 'full-width', key: 'Ａ', composingKey: undefined },
    { label: 'Chinese IME completion', key: '中', composingKey: 'Process' }
  ])('starts a text draft from a $label printable key without committing', async (testCase) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!nameCell) throw new Error('editable name cell missing');

    await user.click(nameCell);
    if (testCase.composingKey) {
      fireEvent.keyDown(nameCell, { key: testCase.composingKey, isComposing: true });
      expect(nameCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    }
    fireEvent.keyDown(nameCell, { key: testCase.key });

    const input = await screen.findByRole('textbox', { name: '编辑名称' });
    expect(input).toHaveValue(testCase.key);
    expect(nameCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores modified printable shortcuts and printable keys on a multi-cell range', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="name"]'
    );
    if (!firstNameCell || !secondNameCell) throw new Error('editable name cells missing');

    await user.click(firstNameCell);
    fireEvent.keyDown(firstNameCell, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(firstNameCell, { key: 'a', metaKey: true });
    fireEvent.keyDown(firstNameCell, { key: 'a', altKey: true });
    expect(screen.queryByRole('textbox', { name: '编辑名称' })).not.toBeInTheDocument();

    dragCellRange(firstNameCell, secondNameCell);
    fireEvent.keyDown(secondNameCell, { key: 'x' });
    expect(screen.queryByRole('textbox', { name: '编辑名称' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('validates the first printable numeric draft with its codec', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<KeyboardSelectionHarness onChange={onChange} />);
    const targetCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="amount"]'
    );
    if (!targetCell) throw new Error('editable amount cell missing');

    await user.click(targetCell);
    fireEvent.keyDown(targetCell, { key: '1' });

    const input = await screen.findByRole('textbox', { name: '编辑金额' });
    expect(input).toHaveValue('1');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    {
      columnId: 'effectiveDate',
      dialogName: '生效日期日历',
      editorLabel: '编辑生效日期',
      error: '日期格式必须为 YYYY-MM-DD。'
    },
    {
      columnId: 'startsAt',
      dialogName: '开始时间日期时间编辑器',
      editorLabel: '编辑开始时间',
      error: '日期时间格式必须为 YYYY-MM-DD HH:mm:ss。'
    }
  ])(
    'validates a printable $columnId draft without restoring the removed full-text input',
    async (testCase) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(<KeyboardSelectionHarness onChange={onChange} />);
      const targetCell = container.querySelector<HTMLTableCellElement>(
        `td[data-cell-column-id="${testCase.columnId}"]`
      );
      if (!targetCell) throw new Error(`editable ${testCase.columnId} cell missing`);

      await user.click(targetCell);
      fireEvent.keyDown(targetCell, { key: '2' });

      expect(await screen.findByRole('dialog', { name: testCase.dialogName })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: testCase.editorLabel })).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(testCase.error);
      expect(targetCell).toHaveAttribute('data-cell-interaction-state', 'editing');
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it('clears a selected range through one atomic delete event', async () => {
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondStatusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="status"]'
    );
    if (!firstNameCell || !secondStatusCell) throw new Error('delete range cells missing');

    dragCellRange(firstNameCell, secondStatusCell);
    fireEvent.keyDown(secondStatusCell, { key: 'Delete' });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'delete',
        changes: [
          expect.objectContaining({ rowId: '1', field: 'name', value: '' }),
          expect.objectContaining({ rowId: '1', field: 'status', value: null }),
          expect.objectContaining({ rowId: '2', field: 'name', value: '' }),
          expect.objectContaining({ rowId: '2', field: 'status', value: null })
        ]
      })
    );
    expect(firstNameCell).not.toHaveTextContent('记录 1');
    expect(secondStatusCell).not.toHaveTextContent('就绪');
  });

  it('only offers the fill handle for fully editable ranges', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditableSelectionHarness onChange={vi.fn()} />);
    const firstIdCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="id"]'
    );
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!firstIdCell || !firstNameCell) throw new Error('fill visibility cells missing');

    await user.click(firstIdCell);
    expect(firstIdCell).toHaveAttribute('data-cell-selected', 'true');
    expect(screen.queryByRole('button', { name: '填充所选单元格' })).not.toBeInTheDocument();

    dragCellRange(firstIdCell, firstNameCell);
    expect(container.querySelectorAll('td[data-cell-selected="true"]')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '填充所选单元格' })).not.toBeInTheDocument();

    await user.click(firstNameCell);
    expect(screen.getByRole('button', { name: '填充所选单元格' })).toBeInTheDocument();
  });

  it('fills a range from the accessible handle through one atomic change event', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="name"]'
    );
    if (!firstNameCell || !secondNameCell) throw new Error('fill target cells missing');

    await user.click(firstNameCell);
    const handle = screen.getByRole('button', { name: '填充所选单元格' });
    dispatchCellPointerEvent(handle, 'pointerdown', { pointerId: 7 });
    dispatchCellPointerEvent(secondNameCell, 'pointermove', {
      pointerId: 7,
      clientX: 40,
      clientY: 80
    });
    expect(secondNameCell).toHaveAttribute('data-cell-fill-preview', 'true');
    dispatchCellPointerEvent(secondNameCell, 'pointerup', {
      pointerId: 7,
      clientX: 40,
      clientY: 80
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'fill',
        changes: [
          {
            rowId: '2',
            field: 'name',
            previousValue: '记录 2',
            value: '记录 1'
          }
        ]
      })
    );
    expect(secondNameCell).toHaveTextContent('记录 1');
    expect(container.querySelectorAll('td[data-cell-selected="true"]')).toHaveLength(2);
  });

  it('offers arrow-key fill as an accessible fallback', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!firstNameCell) throw new Error('fill source cell missing');

    await user.click(firstNameCell);
    const handle = screen.getByRole('button', { name: '填充所选单元格' });
    handle.focus();
    await user.keyboard('{ArrowDown}');

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'fill',
        changes: [expect.objectContaining({ rowId: '2', field: 'name', value: '记录 1' })]
      })
    );
  });

  it('auto-scrolls its own viewport while dragging the fill handle', async () => {
    let frame: FrameRequestCallback | null = null;
    const cancelAnimationFrame = vi.fn();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 17;
    });
    window.cancelAnimationFrame = cancelAnimationFrame;

    const user = userEvent.setup();
    const { container } = render(<EditableSelectionHarness onChange={vi.fn()} />);
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperties(viewport, {
      clientWidth: { value: 200 },
      clientHeight: { value: 100 },
      scrollWidth: { value: 500 },
      scrollHeight: { value: 400 }
    });
    Object.defineProperty(viewport, 'scrollLeft', { value: 100, writable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 100, writable: true });
    viewport.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    viewport.scrollBy = vi.fn();

    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="name"]'
    );
    if (!firstNameCell || !secondNameCell) throw new Error('fill auto-scroll cells missing');
    secondNameCell.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 200, bottom: 100, width: 100, height: 40 }) as DOMRect;

    await user.click(firstNameCell);
    const handle = screen.getByRole('button', { name: '填充所选单元格' });
    dispatchCellPointerEvent(handle, 'pointerdown', { pointerId: 9 });
    dispatchCellPointerEvent(secondNameCell, 'pointermove', {
      pointerId: 9,
      clientX: 200,
      clientY: 100
    });

    expect(viewport).toHaveAttribute('data-cell-fill-dragging', 'true');
    expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
    act(() => frame?.(0));
    expect(viewport.scrollBy).toHaveBeenCalledWith({ behavior: 'auto', left: 20, top: 20 });

    dispatchCellPointerEvent(secondNameCell, 'pointerup', {
      pointerId: 9,
      clientX: 200,
      clientY: 100
    });
    expect(viewport).not.toHaveAttribute('data-cell-fill-dragging');
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('clears one cell with Backspace and keeps focus on the selected cell', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!nameCell) throw new Error('backspace target cell missing');

    await user.click(nameCell);
    fireEvent.keyDown(nameCell, { key: 'Backspace' });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'delete',
        changes: [expect.objectContaining({ rowId: '1', field: 'name', value: '' })]
      })
    );
    expect(nameCell).toHaveFocus();
    expect(nameCell).toHaveAttribute('data-cell-selected', 'true');
  });

  it('keeps an atomic delete at zero writes for required or readonly cells', async () => {
    const user = userEvent.setup();
    const requiredChange = vi.fn();
    const required = render(<KeyboardSelectionHarness onChange={requiredChange} />);
    const requiredName = required.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="requiredName"]'
    );
    const amount = required.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="amount"]'
    );
    if (!requiredName || !amount) throw new Error('required delete cells missing');

    dragCellRange(requiredName, amount);
    fireEvent.keyDown(amount, { key: 'Delete' });
    await act(async () => undefined);
    expect(requiredName).toHaveTextContent('原名称');
    expect(amount).toHaveTextContent('12.5');
    expect(requiredChange).not.toHaveBeenCalled();
    required.unmount();

    const readonlyChange = vi.fn();
    const readonly = render(
      <EditableSelectionHarness
        onChange={readonlyChange}
        isCellEditable={({ columnId }) => columnId !== 'status'}
      />
    );
    const firstName = readonly.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const firstStatus = readonly.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="status"]'
    );
    if (!firstName || !firstStatus) throw new Error('readonly delete cells missing');

    await user.click(firstName);
    dragCellRange(firstName, firstStatus);
    fireEvent.keyDown(firstStatus, { key: 'Delete' });
    await act(async () => undefined);
    expect(firstName).toHaveTextContent('记录 1');
    expect(firstStatus).toHaveTextContent('草稿');
    expect(readonlyChange).not.toHaveBeenCalled();
  });

  it('keeps selected, edit-ready, and editing states exclusive across cells', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const cells = container.querySelectorAll<HTMLTableCellElement>(
      'td[data-cell-column-id="status"]'
    );
    const firstCell = cells[0];
    const secondCell = cells[1];
    if (!firstCell || !secondCell) throw new Error('editable cells missing');

    await user.click(firstCell);
    expect(firstCell).toHaveAttribute('data-cell-selected', 'true');
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(firstCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(firstCell).not.toHaveAttribute('data-cell-editing');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    fireEvent.keyDown(firstCell, { key: 'Enter' });
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(firstCell).toHaveAttribute('data-cell-editing', 'true');
    expect(await screen.findByRole('option', { name: '就绪' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(firstCell).toHaveAttribute('data-cell-edit-ready', 'true');
    expect(firstCell).not.toHaveAttribute('data-cell-editing');
    expect(
      firstCell.querySelector('[data-slot="data-table-choice-editor-ready-trigger"]')
    ).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();

    await user.click(secondCell);
    expect(firstCell).not.toHaveAttribute('data-cell-interaction-state');
    expect(firstCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(secondCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(
      container.querySelectorAll(
        'td[data-cell-interaction-state="selected"], td[data-cell-interaction-state="edit-ready"], td[data-cell-interaction-state="editing"]'
      )
    ).toHaveLength(1);

    await user.dblClick(secondCell);
    expect(secondCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(await screen.findByRole('option', { name: '草稿' })).toBeInTheDocument();
  });

  it('selects the rectangular cells between pointer anchor and focus in either direction', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dragCellRange(firstIdCell, secondNameCell);

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(4);
    expect(firstIdCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(secondNameCell).toHaveAttribute('data-cell-range-focus', 'true');

    dragCellRange(secondNameCell, firstIdCell);

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(4);
    expect(secondNameCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(firstIdCell).toHaveAttribute('data-cell-range-focus', 'true');
  });

  it('extends the current anchor with Shift plus pointer down', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstNameCell = getBodyCell(container, 0, 'Item 1');
    const secondIdCell = getBodyCell(container, 1, '2');

    dispatchCellPointerEvent(firstNameCell, 'pointerdown', { pointerId: 1 });
    dispatchCellPointerEvent(firstNameCell, 'pointerup', { pointerId: 1 });
    dispatchCellPointerEvent(secondIdCell, 'pointerdown', { pointerId: 2, shiftKey: true });
    dispatchCellPointerEvent(secondIdCell, 'pointerup', { pointerId: 2 });

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(4);
    expect(firstNameCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(secondIdCell).toHaveAttribute('data-cell-range-focus', 'true');
  });

  it('moves with arrows, extends with Shift arrows, and clears with Escape', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const firstNameCell = getBodyCell(container, 0, 'Item 1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dispatchCellPointerEvent(firstIdCell, 'pointerdown', { pointerId: 1 });
    dispatchCellPointerEvent(firstIdCell, 'pointerup', { pointerId: 1 });
    fireEvent.keyDown(firstIdCell, { key: 'ArrowRight' });

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(firstNameCell).toHaveFocus();
    expect(firstIdCell).not.toHaveAttribute('data-cell-selected');

    fireEvent.keyDown(firstNameCell, { key: 'ArrowDown', shiftKey: true });

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(secondNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(secondNameCell).toHaveFocus();

    fireEvent.keyDown(secondNameCell, { key: 'Escape' });
    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(0);
  });

  it('preserves a pointer range when its focus cell receives focus before Shift arrow', () => {
    const { container } = render(<Harness rows={makeRows(3)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dragCellRange(firstIdCell, secondNameCell);
    secondNameCell.focus();
    fireEvent.keyDown(secondNameCell, { key: 'ArrowDown', shiftKey: true });

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(6);
    expect(firstIdCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(getBodyCell(container, 2, 'Item 3')).toHaveAttribute('data-cell-range-focus', 'true');
  });

  it('copies a selected rectangle as row-major TSV', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dragCellRange(firstIdCell, secondNameCell);
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '1\tItem 1\n2\tItem 2');
    expect(event.defaultPrevented).toBe(true);
  });

  it('pastes one raw value through the selected cell bound codec', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!nameCell) throw new Error('editable name cell missing');

    await user.click(nameCell);
    const { clipboardData, event } = createPasteEvent('123.45');
    document.dispatchEvent(event);

    expect(clipboardData.getData).toHaveBeenCalledWith('text/plain');
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(nameCell).toHaveTextContent('123.45'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [
          {
            rowId: '1',
            field: 'name',
            previousValue: '记录 1',
            value: '123.45'
          }
        ]
      })
    );
  });

  it('pastes and copies percent cells through percentage-point text without adornments', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableNumericSelectionHarness onChange={onChange} />);
    const rateCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="rate"]'
    );
    if (!rateCell) throw new Error('editable percent cell missing');

    await user.click(rateCell);
    const paste = createPasteEvent('１２．５％');
    document.dispatchEvent(paste.event);

    expect(paste.event.defaultPrevented).toBe(true);
    await waitFor(() => expect(rateCell).toHaveTextContent('12.50%'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [expect.objectContaining({ field: 'rate', value: 0.125 })]
      })
    );

    document.getSelection()?.removeAllRanges();
    const copy = createCopyEvent();
    document.dispatchEvent(copy.event);
    expect(copy.clipboardData.setData).toHaveBeenCalledWith('text/plain', '12.5');
  });

  it('keeps a readonly target unchanged and applies a valid matrix atomically', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const idCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="id"]'
    );
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondStatusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="status"]'
    );
    if (!idCell || !firstNameCell || !secondStatusCell) {
      throw new Error('paste target cells missing');
    }

    await user.click(idCell);
    const readonlyPaste = createPasteEvent('99');
    document.dispatchEvent(readonlyPaste.event);

    expect(readonlyPaste.event.defaultPrevented).toBe(true);
    expect(idCell).toHaveTextContent('1');
    expect(onChange).not.toHaveBeenCalled();

    dragCellRange(firstNameCell, secondStatusCell);
    const matrixPaste = createPasteEvent('新名称\tREADY\n另一名称\tDRAFT');
    document.dispatchEvent(matrixPaste.event);

    expect(matrixPaste.event.defaultPrevented).toBe(true);
    await waitFor(() => expect(firstNameCell).toHaveTextContent('新名称'));
    expect(secondStatusCell).toHaveTextContent('草稿');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [
          {
            rowId: '1',
            field: 'name',
            previousValue: '记录 1',
            value: '新名称'
          },
          {
            rowId: '1',
            field: 'status',
            previousValue: 'DRAFT',
            value: 'READY'
          },
          {
            rowId: '2',
            field: 'name',
            previousValue: '记录 2',
            value: '另一名称'
          },
          {
            rowId: '2',
            field: 'status',
            previousValue: 'READY',
            value: 'DRAFT'
          }
        ]
      })
    );
  });

  it('keeps every target unchanged when one matrix value is invalid', async () => {
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondStatusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="status"]'
    );
    if (!firstNameCell || !secondStatusCell) {
      throw new Error('matrix paste target cells missing');
    }

    dragCellRange(firstNameCell, secondStatusCell);
    const matrixPaste = createPasteEvent('新名称\tREADY\t越界值\n另一名称\tDRAFT\t另一个越界值');
    document.dispatchEvent(matrixPaste.event);

    expect(matrixPaste.event.defaultPrevented).toBe(true);
    await act(async () => undefined);
    expect(firstNameCell).toHaveTextContent('记录 1');
    expect(secondStatusCell).toHaveTextContent('就绪');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('auto-scrolls its own viewport while dragging in the bottom-right edge zone', () => {
    let frame: FrameRequestCallback | null = null;
    const cancelAnimationFrame = vi.fn();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 11;
    });
    window.cancelAnimationFrame = cancelAnimationFrame;

    const { container } = render(<Harness rows={makeRows(2)} />);
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperties(viewport, {
      clientWidth: { value: 200 },
      clientHeight: { value: 100 },
      scrollWidth: { value: 500 },
      scrollHeight: { value: 400 }
    });
    Object.defineProperty(viewport, 'scrollLeft', { value: 100, writable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 100, writable: true });
    viewport.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    viewport.scrollBy = vi.fn();

    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');
    secondNameCell.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 200, bottom: 100, width: 100, height: 40 }) as DOMRect;

    dispatchCellPointerEvent(firstIdCell, 'pointerdown', { pointerId: 1 });
    dispatchCellPointerEvent(secondNameCell, 'pointermove', {
      pointerId: 1,
      clientX: 200,
      clientY: 100
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
    act(() => frame?.(0));
    expect(viewport.scrollBy).toHaveBeenCalledWith({ behavior: 'auto', left: 20, top: 20 });

    dispatchCellPointerEvent(secondNameCell, 'pointerup', { pointerId: 1 });
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('marks only the active pointer sequence as text-selection suppressed', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const viewport = screen.getByTestId('scroll-viewport');
    const firstIdCell = getBodyCell(container, 0, '1');

    expect(viewport).not.toHaveAttribute('data-cell-range-dragging');
    dispatchCellPointerEvent(firstIdCell, 'pointerdown', { pointerId: 1 });
    expect(viewport).toHaveAttribute('data-cell-range-dragging', 'true');
    dispatchCellPointerEvent(firstIdCell, 'pointerup', { pointerId: 1 });
    expect(viewport).not.toHaveAttribute('data-cell-range-dragging');
  });

  it('marks the clicked data cell as active without treating checkbox controls as cells', async () => {
    const user = userEvent.setup();
    const { container } = render(<SelectableHarness rows={makeRows(2)} />);
    const dataCells = container.querySelectorAll('tbody td[data-cell-id]');
    const firstNameCell = Array.from(dataCells).find((cell) => cell.textContent === 'Item 1');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(firstNameCell).toHaveAttribute(
      'data-cell-range-edge',
      'block-start inline-end block-end inline-start'
    );

    const firstRowCheckbox = screen.getAllByRole('checkbox', { name: '选择行' })[0];
    await user.click(firstRowCheckbox);

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(dataCells).filter((cell) => cell.getAttribute('data-cell-selected') === 'true')
    ).toHaveLength(1);
  });

  it('copies the active cell text on copy events', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    });
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'Item 1');
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute('data-cell-copy-flash', 'true');
    });
    const firstCopyFlashRun = firstNameCell.getAttribute('data-cell-copy-flash-run');
    expect(firstCopyFlashRun).toMatch(/^(a|b)$/);

    const { clipboardData: secondClipboardData, event: secondEvent } = createCopyEvent();
    document.dispatchEvent(secondEvent);

    expect(secondClipboardData.setData).toHaveBeenCalledWith('text/plain', 'Item 1');
    expect(secondEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute(
        'data-cell-copy-flash-run',
        firstCopyFlashRun === 'a' ? 'b' : 'a'
      );
    });
  });

  it('copies active cell text with normalized line breaks', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    Object.defineProperty(firstNameCell, 'innerText', {
      configurable: true,
      value: 'Line 1\r\nLine 2'
    });

    await user.click(firstNameCell);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    });
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '"Line 1\nLine 2"');
    expect(event.defaultPrevented).toBe(true);
  });

  it('copies money type cells without thousands separators', async () => {
    const user = userEvent.setup();
    render(<MoneyCopyHarness rows={[{ id: 1, amount: 1234.5 }]} />);
    const amountCell = screen.getByText('1,234.50').closest('td');

    if (!(amountCell instanceof HTMLElement)) {
      throw new Error('amount cell missing');
    }

    await user.click(amountCell);
    await waitFor(() => {
      expect(amountCell).toHaveAttribute('data-cell-selected', 'true');
    });
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '1234.5');
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not override copy from editable controls', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { clipboardData, event } = createCopyEvent();
    input.dispatchEvent(event);

    expect(clipboardData.setData).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    input.remove();
  });

  it('does not override copy when the user has a text selection', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);

    const selectedText = document.createElement('span');
    selectedText.textContent = 'manual selection';
    document.body.appendChild(selectedText);

    const range = document.createRange();
    range.selectNodeContents(selectedText);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    document.getSelection()?.removeAllRanges();
    selectedText.remove();
  });

  it('does not mark row-number or actions cells as active', async () => {
    const user = userEvent.setup();
    const { container } = render(<SpecialColumnsSelectionHarness rows={makeRows(2)} />);
    const firstRowCells = container.querySelectorAll<HTMLTableCellElement>(
      'tbody tr:first-child td[data-cell-id]'
    );
    const rowNumberCell = firstRowCells[0];
    const actionCell = firstRowCells[firstRowCells.length - 1];
    const nameCell = Array.from(firstRowCells).find((cell) => cell.textContent === 'Item 1');

    if (!rowNumberCell || !actionCell || !(nameCell instanceof HTMLElement)) {
      throw new Error('special columns selection fixture is incomplete');
    }

    await user.click(nameCell);
    expect(nameCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(rowNumberCell);
    expect(rowNumberCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);

    await user.click(nameCell);
    expect(nameCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(actionCell);
    expect(actionCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);
  });

  it('does not mark pinned cells as active', async () => {
    const user = userEvent.setup();
    const { container } = render(<WideHarness rows={makeWideRows(1, 2)} virtualization={false} />);
    const pinnedLeftCell = screen.getByText('L1').closest('td');
    const pinnedRightCell = screen.getByText('R1').closest('td');
    const centerCell = screen.getByText('R1C0').closest('td');

    if (
      !(pinnedLeftCell instanceof HTMLElement) ||
      !(pinnedRightCell instanceof HTMLElement) ||
      !(centerCell instanceof HTMLElement)
    ) {
      throw new Error('pinned cells selection fixture is incomplete');
    }

    await user.click(centerCell);
    expect(centerCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(pinnedLeftCell);
    expect(pinnedLeftCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);

    await user.click(centerCell);
    expect(centerCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(pinnedRightCell);
    expect(pinnedRightCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);
  });
});
