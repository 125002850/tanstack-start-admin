import { describe, expect, it, vi } from 'vitest';

import type { DataTableFinishEditingResult, DataTableEditingRuntime } from '@/types/data-table';

import { finishEditingAndNavigate } from './data-table-editor-navigation';

function createRuntime(result: DataTableFinishEditingResult) {
  return {
    activeCell: null,
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

function createEditableRow() {
  const table = document.createElement('table');
  const row = table.insertRow();
  const previous = row.insertCell();
  const current = row.insertCell();
  const readonly = row.insertCell();
  const next = row.insertCell();
  previous.dataset.cellEditable = 'true';
  current.dataset.cellEditable = 'true';
  next.dataset.cellEditable = 'true';
  for (const cell of [previous, current, readonly, next]) {
    cell.tabIndex = -1;
  }
  document.body.append(table);
  return { table, previous, current, readonly, next };
}

describe('finishEditingAndNavigate', () => {
  it.each([{ status: 'committed' as const }, { status: 'unchanged' as const }])(
    'moves in a microtask after a $status result',
    async (result) => {
      const runtime = createRuntime(result);
      const { table, current, next } = createEditableRow();
      current.focus();

      const finishResult = finishEditingAndNavigate({
        runtime,
        sessionId: 7,
        cell: current,
        direction: 'next'
      });

      expect(finishResult).toEqual(result);
      expect(current).toHaveFocus();
      await Promise.resolve();
      expect(next).toHaveFocus();
      table.remove();
    }
  );

  it('moves to the previous editable cell for Shift+Tab', async () => {
    const runtime = createRuntime({ status: 'unchanged' });
    const { table, previous, current } = createEditableRow();
    current.focus();

    finishEditingAndNavigate({
      runtime,
      sessionId: 8,
      cell: current,
      direction: 'previous'
    });

    await Promise.resolve();
    expect(previous).toHaveFocus();
    table.remove();
  });

  it('fails closed instead of skipping virtualized columns', async () => {
    const runtime = createRuntime({ status: 'committed' });
    const { table, current } = createEditableRow();
    const body = table.tBodies.item(0);
    if (!body) throw new Error('editable row body missing');
    body.dataset.columnVirtualEnabled = 'true';
    current.focus();

    const finishResult = finishEditingAndNavigate({
      runtime,
      sessionId: 9,
      cell: current,
      direction: 'next'
    });

    await Promise.resolve();
    expect(finishResult).toEqual({ status: 'committed' });
    expect(current).toHaveFocus();
    table.remove();
  });

  it.each<DataTableFinishEditingResult>([
    { status: 'blocked', errors: ['Invalid value.'] },
    { status: 'reverted', reason: 'invalid-edit' },
    { status: 'stale-session' }
  ])('does not navigate after a $status result', async (result) => {
    const runtime = createRuntime(result);
    const { table, current } = createEditableRow();
    current.focus();

    const finishResult = finishEditingAndNavigate({
      runtime,
      sessionId: 9,
      cell: current,
      direction: 'next'
    });

    await Promise.resolve();
    expect(finishResult).toEqual(result);
    expect(current).toHaveFocus();
    table.remove();
  });
});
