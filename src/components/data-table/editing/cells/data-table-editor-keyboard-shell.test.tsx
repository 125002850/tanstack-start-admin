import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DataTableFinishEditingResult, DataTableEditingRuntime } from '../types';

import { DataTableEditorKeyboardShell } from './data-table-editor-keyboard-shell';

function createRuntime(result: DataTableFinishEditingResult) {
  return {
    activeCell: { sessionId: 17 } as never,
    readyCell: null,
    isCellEditable: vi.fn(() => true),
    selectCell: vi.fn(),
    clearCellSelection: vi.fn(),
    startEditing: vi.fn(() => null),
    setActiveDraft: vi.fn(),
    registerEditorAnchor: vi.fn(() => vi.fn()),
    finishEditing: vi.fn(() => result),
    cancelEditing: vi.fn(),
    commitCandidate: vi.fn(() => ({ status: 'unchanged' as const })),
    commitInput: vi.fn(() => ({ status: 'unchanged' as const })),
    getRevision: vi.fn(() => 0),
    applyBatch: vi.fn(() => ({ status: 'unchanged' as const }))
  } satisfies DataTableEditingRuntime<unknown>;
}

function ShellHarness({
  runtime,
  profile = 'singleLine'
}: {
  runtime: DataTableEditingRuntime<unknown>;
  profile?: React.ComponentProps<typeof DataTableEditorKeyboardShell>['profile'];
}) {
  return (
    <table>
      <tbody>
        <tr>
          <td data-cell-editable='true' tabIndex={-1}>
            <button type='button'>Previous</button>
          </td>
          <td data-cell-editable='true' data-testid='current-cell' tabIndex={-1}>
            <DataTableEditorKeyboardShell runtime={runtime} sessionId={17} profile={profile}>
              <input aria-label='Editor' />
            </DataTableEditorKeyboardShell>
          </td>
          <td data-cell-editable='true' tabIndex={-1}>
            <button type='button'>Next</button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

describe('DataTableEditorKeyboardShell', () => {
  afterEach(cleanup);

  it('commits single-line Enter and restores focus to the current cell', async () => {
    const runtime = createRuntime({ status: 'committed' });
    render(<ShellHarness runtime={runtime} />);
    const input = screen.getByRole('textbox', { name: 'Editor' });
    input.focus();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(runtime.finishEditing).toHaveBeenCalledWith(17, 'enter');
    await Promise.resolve();
    expect(screen.getByTestId('current-cell')).toHaveFocus();
  });

  it('commits manual date input with Enter', () => {
    const runtime = createRuntime({ status: 'committed' });
    render(<ShellHarness runtime={runtime} profile='date' />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Editor' }), {
      key: 'Enter'
    });

    expect(runtime.finishEditing).toHaveBeenCalledWith(17, 'enter');
  });

  it('keeps a blocked Tab in the current editor and only navigates on success', async () => {
    const blockedRuntime = createRuntime({
      status: 'blocked',
      errors: ['Invalid value.']
    });
    const { rerender } = render(<ShellHarness runtime={blockedRuntime} />);
    const input = screen.getByRole('textbox', { name: 'Editor' });
    input.focus();

    fireEvent.keyDown(input, { key: 'Tab' });

    await Promise.resolve();
    expect(input).toHaveFocus();

    const committedRuntime = createRuntime({ status: 'committed' });
    rerender(<ShellHarness runtime={committedRuntime} />);
    const currentInput = screen.getByRole('textbox', { name: 'Editor' });
    currentInput.focus();
    fireEvent.keyDown(currentInput, { key: 'Tab' });

    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Next' }).closest('td')).toHaveFocus();
  });

  it('moves backwards for Shift+Tab', async () => {
    const runtime = createRuntime({ status: 'unchanged' });
    render(<ShellHarness runtime={runtime} />);
    const input = screen.getByRole('textbox', { name: 'Editor' });
    input.focus();

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });

    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Previous' }).closest('td')).toHaveFocus();
  });

  it('ignores key commands while IME composition is active', () => {
    const runtime = createRuntime({ status: 'committed' });
    render(<ShellHarness runtime={runtime} />);
    const input = screen.getByRole('textbox', { name: 'Editor' });

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(input, { key: 'Tab', isComposing: true });

    expect(runtime.finishEditing).not.toHaveBeenCalled();
    expect(runtime.cancelEditing).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(runtime.finishEditing).toHaveBeenCalledOnce();
  });

  it('leaves choice Enter to the listbox and honors a consumed child event', () => {
    const runtime = createRuntime({ status: 'committed' });
    render(
      <DataTableEditorKeyboardShell runtime={runtime} sessionId={17} profile='choice'>
        <button
          type='button'
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.preventDefault();
          }}
        >
          Choice
        </button>
      </DataTableEditorKeyboardShell>
    );
    const choice = screen.getByRole('button', { name: 'Choice' });

    fireEvent.keyDown(choice, { key: 'Enter' });
    fireEvent.keyDown(choice, { key: 'Escape' });

    expect(runtime.finishEditing).not.toHaveBeenCalled();
    expect(runtime.cancelEditing).not.toHaveBeenCalled();
  });

  it.each([
    ['Control', { ctrlKey: true }],
    ['Meta', { metaKey: true }]
  ] as const)('keeps multiline Enter and commits with %s+Enter', (_modifier, modifier) => {
    const runtime = createRuntime({ status: 'committed' });
    render(<ShellHarness runtime={runtime} profile='multiline' />);
    const input = screen.getByRole('textbox', { name: 'Editor' });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(runtime.finishEditing).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter', ...modifier });
    expect(runtime.finishEditing).toHaveBeenCalledWith(17, 'enter');
  });

  it('honors defaultPrevented from a portaled child', () => {
    const runtime = createRuntime({ status: 'committed' });

    function PortaledControl() {
      return createPortal(
        <button type='button' onKeyDown={(event) => event.preventDefault()}>
          Portal control
        </button>,
        document.body
      );
    }

    render(
      <DataTableEditorKeyboardShell runtime={runtime} sessionId={17} profile='choice'>
        <PortaledControl />
      </DataTableEditorKeyboardShell>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Portal control' }), {
      key: 'Escape'
    });

    expect(runtime.cancelEditing).not.toHaveBeenCalled();
  });

  it('does not move focus for a stale delayed event and detaches its session anchor on unmount', async () => {
    const runtime = createRuntime({ status: 'stale-session' });
    const { unmount } = render(<ShellHarness runtime={runtime} />);
    const input = screen.getByRole('textbox', { name: 'Editor' });
    input.focus();

    fireEvent.keyDown(input, { key: 'Tab' });

    await Promise.resolve();
    expect(input).toHaveFocus();
    expect(runtime.finishEditing).toHaveBeenCalledWith(17, 'tab');

    unmount();
    expect(runtime.registerEditorAnchor).toHaveBeenCalledWith(17, {
      closePopup: expect.any(Function)
    });
    expect(vi.mocked(runtime.registerEditorAnchor).mock.results[0]?.value).toHaveBeenCalledOnce();
    expect(runtime.finishEditing).toHaveBeenCalledOnce();
  });
});
