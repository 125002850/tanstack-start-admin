import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  resolveDataTableEditableCell,
  type ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-adapters';
import type { DataTableEditableColumnMeta } from '@/types/data-table';

import { useDataTableEditing } from './use-data-table-editing';

type Row = {
  id: number;
  name: string;
  status: 'DRAFT' | 'READY' | null;
  roleIds: number[];
  amount?: number | null;
  effectiveDate?: string | null;
  executeAt?: string | null;
};

function resolveEditableCell(
  context: ResolveDataTableEditableCellContext<Row>
): DataTableEditableColumnMeta<Row> {
  const resolved = resolveDataTableEditableCell(context);
  if (!resolved) throw new Error(`editable adapter missing for ${context.type}`);
  return resolved.columnMeta.editableCell;
}

const editableFields = new Map<keyof Row & string, DataTableEditableColumnMeta<Row>>([
  [
    'status',
    resolveEditableCell({
      field: 'status',
      title: '状态',
      type: 'enum',
      edit: { selectionMode: 'single', allowEmpty: true },
      valueOptions: [
        { value: 'DRAFT', label: '草稿' },
        { value: 'READY', label: '就绪' }
      ]
    })
  ],
  [
    'roleIds',
    resolveEditableCell({
      field: 'roleIds',
      title: '角色',
      type: 'select',
      edit: { selectionMode: 'multiple', allowEmpty: true },
      valueOptions: [
        { value: 1, label: '管理员' },
        { value: 2, label: '审计员' }
      ]
    })
  ]
]);

function renderEditing(
  onChange = vi.fn(),
  fields: ReadonlyMap<keyof Row & string, DataTableEditableColumnMeta<Row>> = editableFields,
  isCellEditable?: (context: { rowId: string; row: Row; columnId: string }) => boolean
) {
  return renderHook(() =>
    useDataTableEditing<Row>({
      tableId: 'editing-test',
      editableFields: fields,
      getRowId: (row) => String(row.id),
      options: { onChange, isCellEditable }
    })
  );
}

function requireSession(sessionId: number | null): number {
  if (sessionId === null) throw new Error('editing session was not started');
  return sessionId;
}

describe('useDataTableEditing', () => {
  it('sets and clears typed server cell errors in batches without changing the snapshot', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }]);
    });
    const revision = result.current.getRevision();
    let setResult: ReturnType<typeof result.current.setServerCellErrors> | undefined;
    act(() => {
      setResult = result.current.setServerCellErrors({
        revision,
        errors: [
          {
            rowId: '1',
            field: 'status',
            messages: ['状态已被服务端拒绝'],
            code: 'STATUS_CONFLICT'
          },
          {
            rowId: '1',
            field: 'roleIds',
            messages: ['角色不可用']
          }
        ]
      });
    });

    expect(setResult).toEqual({ applied: 2, skipped: 0 });
    expect(result.current.getServerCellErrors()).toEqual([
      {
        rowId: '1',
        field: 'status',
        messages: ['状态已被服务端拒绝'],
        code: 'STATUS_CONFLICT',
        revision
      },
      {
        rowId: '1',
        field: 'roleIds',
        messages: ['角色不可用'],
        revision
      }
    ]);
    expect(result.current.runtime.getServerCellError?.('1', 'status')).toEqual(
      expect.objectContaining({ messages: ['状态已被服务端拒绝'] })
    );
    expect(result.current.getSnapshot()).toMatchObject({
      rows: [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }],
      changedRows: [],
      changes: []
    });

    act(() => {
      result.current.clearServerCellErrors({
        cells: [{ rowId: '1', field: 'status' }]
      });
    });
    expect(result.current.getServerCellErrors()).toEqual([
      expect.objectContaining({ rowId: '1', field: 'roleIds' })
    ]);
  });

  it('ignores a stale server error response after a newer edit or session', () => {
    const { result } = renderEditing();
    let staleRevision = 0;
    let currentRevision = 0;

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }]);
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: 'READY' }
      });
      staleRevision = result.current.getRevision();
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: null }
      });
      currentRevision = result.current.getRevision();
    });

    let staleResult: ReturnType<typeof result.current.setServerCellErrors> | undefined;
    act(() => {
      result.current.setServerCellErrors({
        revision: currentRevision,
        errors: [{ rowId: '1', field: 'status', messages: ['当前错误'] }]
      });
      staleResult = result.current.setServerCellErrors({
        revision: staleRevision,
        errors: [{ rowId: '1', field: 'status', messages: ['过期错误'] }]
      });
    });
    expect(staleResult).toEqual({ applied: 0, skipped: 1 });
    expect(result.current.runtime.getServerCellError?.('1', 'status')?.messages).toEqual([
      '当前错误'
    ]);

    const beforeSession = result.current.getRevision();
    act(() => {
      result.current.runtime.startEditing({
        rowId: '1',
        row: result.current.getRowsForPage(1)[0]!,
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1]
      });
    });
    let sessionStale: ReturnType<typeof result.current.setServerCellErrors> | undefined;
    act(() => {
      sessionStale = result.current.setServerCellErrors({
        revision: beforeSession,
        errors: [{ rowId: '1', field: 'roleIds', messages: ['旧请求错误'] }]
      });
    });
    expect(sessionStale).toEqual({ applied: 0, skipped: 1 });
    expect(result.current.runtime.getServerCellError?.('1', 'roleIds')).toBeUndefined();
  });

  it('clears a cell error after a successful local commit and preserves other failed cells', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }]);
    });
    const initialRevision = result.current.getRevision();
    act(() => {
      result.current.setServerCellErrors({
        revision: initialRevision,
        errors: [
          { rowId: '1', field: 'status', messages: ['状态错误'] },
          { rowId: '1', field: 'roleIds', messages: ['角色错误'] }
        ]
      });
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: 'READY' }
      });
    });

    expect(result.current.runtime.getServerCellError?.('1', 'status')).toBeUndefined();
    expect(result.current.runtime.getServerCellError?.('1', 'roleIds')).toEqual(
      expect.objectContaining({ messages: ['角色错误'] })
    );
    const submitted = result.current.getSnapshot().changes;
    const requestRevision = result.current.getRevision();
    act(() => {
      result.current.acceptChanges(
        submitted.filter((change) => change.field === 'status'),
        undefined,
        { revision: requestRevision }
      );
    });
    expect(result.current.getServerCellErrors()).toEqual([
      expect.objectContaining({ field: 'roleIds' })
    ]);
  });

  it('retains errors across pages and clears them on refresh, row removal, discard and scope change', () => {
    const { result } = renderEditing();
    const firstRow = { id: 1, name: '第一页', status: 'DRAFT' as const, roleIds: [1] };
    const secondRow = { id: 2, name: '第二页', status: 'READY' as const, roleIds: [2] };

    act(() => {
      result.current.loadPage(1, [firstRow]);
    });
    const revision = result.current.getRevision();
    act(() => {
      result.current.setServerCellErrors({
        revision,
        errors: [{ rowId: '1', field: 'status', messages: ['第一页错误'] }]
      });
      result.current.loadPage(2, [secondRow]);
    });
    expect(result.current.runtime.getServerCellError?.('1', 'status')).toBeDefined();

    act(() => result.current.loadPage(1, [firstRow]));
    expect(result.current.runtime.getServerCellError?.('1', 'status')).toBeUndefined();

    const refreshedRevision = result.current.getRevision();
    act(() => {
      result.current.setServerCellErrors({
        revision: refreshedRevision,
        errors: [{ rowId: '1', field: 'status', messages: ['待删除'] }]
      });
      result.current.loadPage(1, []);
    });
    expect(result.current.runtime.getServerCellError?.('1', 'status')).toBeUndefined();

    const pageTwoRevision = result.current.getRevision();
    act(() => {
      result.current.setServerCellErrors({
        revision: pageTwoRevision,
        errors: [{ rowId: '2', field: 'status', messages: ['待放弃'] }]
      });
      result.current.discardChanges();
    });
    expect(result.current.getServerCellErrors()).toEqual([]);

    const afterDiscardRevision = result.current.getRevision();
    act(() => {
      result.current.setServerCellErrors({
        revision: afterDiscardRevision,
        errors: [{ rowId: '2', field: 'status', messages: ['待切换'] }]
      });
      result.current.loadScopePage('next-scope', 1, [firstRow]);
    });
    expect(result.current.getServerCellErrors()).toEqual([]);
  });

  it('merges drafts across loaded pages into an ordered snapshot', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(2, [{ id: 2, name: '第二页', status: 'DRAFT', roleIds: [2] }]);
      result.current.loadPage(1, [{ id: 1, name: '第一页', status: 'DRAFT', roleIds: [1] }]);
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: 'READY' }
      });
      result.current.writeCell({
        rowId: '2',
        field: 'roleIds',
        input: { kind: 'typed-candidate', value: [2, 1] }
      });
    });

    expect(result.current.getSnapshot()).toEqual({
      rows: [
        { id: 1, name: '第一页', status: 'READY', roleIds: [1] },
        { id: 2, name: '第二页', status: 'DRAFT', roleIds: [2, 1] }
      ],
      changedRows: [
        { id: 1, name: '第一页', status: 'READY', roleIds: [1] },
        { id: 2, name: '第二页', status: 'DRAFT', roleIds: [2, 1] }
      ],
      changes: [
        {
          rowId: '1',
          field: 'status',
          previousValue: 'DRAFT',
          value: 'READY'
        },
        {
          rowId: '2',
          field: 'roleIds',
          previousValue: [2],
          value: [2, 1]
        }
      ],
      loadedPages: [1, 2]
    });
    expect(result.current.hasChanges()).toBe(true);
  });

  it('keeps edited fields while applying refetched server fields', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '旧名称', status: 'DRAFT', roleIds: [1] }]);
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: 'READY' }
      });
      result.current.loadPage(1, [{ id: 1, name: '服务端新名称', status: 'DRAFT', roleIds: [2] }]);
    });

    expect(result.current.getRowsForPage(1)).toEqual([
      { id: 1, name: '服务端新名称', status: 'READY', roleIds: [2] }
    ]);
  });

  it('does not let an old save response clear a newer field edit', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }]);
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: 'READY' }
      });
    });
    const submitted = result.current.getSnapshot().changes;

    act(() => {
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: null }
      });
      result.current.acceptChanges(submitted, [
        { id: 1, name: '服务端规范化', status: 'READY', roleIds: [1] }
      ]);
    });

    expect(result.current.getRowsForPage(1)[0]).toMatchObject({
      name: '服务端规范化',
      status: null
    });
    expect(result.current.getSnapshot().changes).toEqual([
      {
        rowId: '1',
        field: 'status',
        previousValue: 'READY',
        value: null
      }
    ]);
  });

  it('discards all drafts without losing loaded pages', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }]);
      result.current.writeCell({
        rowId: '1',
        field: 'roleIds',
        input: { kind: 'typed-candidate', value: [1, 2] }
      });
      result.current.discardChanges();
    });

    expect(result.current.getSnapshot()).toMatchObject({
      rows: [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }],
      changedRows: [],
      changes: [],
      loadedPages: [1]
    });
  });

  it('keeps an active editor value for rendering without publishing it to the snapshot', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderEditing(onChange);
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row: { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] },
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1]
      });
    });
    act(() => result.current.runtime.setActiveDraft(requireSession(sessionId), [1, 2]));

    rerender();

    expect(result.current.getRowsForPage(1)[0]).toMatchObject({
      id: 1,
      roleIds: [1, 2]
    });
    expect(result.current.getSnapshot()).toMatchObject({
      rows: [{ id: 1, name: '记录', status: 'DRAFT', roleIds: [1] }],
      changedRows: [],
      changes: []
    });
    expect(result.current.hasChanges()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    let finishResult: ReturnType<typeof result.current.runtime.finishEditing> | undefined;
    act(() => {
      finishResult = result.current.runtime.finishEditing(requireSession(sessionId), 'enter');
    });
    expect(finishResult).toEqual({ status: 'committed' });
    expect(result.current.getSnapshot().changedRows[0]).toMatchObject({
      id: 1,
      roleIds: [1, 2]
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'enter' }));
  });

  it('keeps unparsed and invalid drafts out of display rows and blocks completion', () => {
    const onChange = vi.fn();
    const blockMeta = {
      ...resolveEditableCell({
        field: 'name',
        title: '名称',
        type: 'text',
        edit: { allowEmpty: false }
      }),
      invalidEditBehavior: 'block' as const
    };
    const fields = new Map(editableFields);
    fields.set('name', blockMeta);
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '原名称', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;
    let blockedResult: ReturnType<typeof result.current.runtime.finishEditing> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'name',
        field: 'name',
        initialValue: '原名称'
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), '-', { parse: false });
    });

    expect(result.current.activeCell).toMatchObject({
      draftValue: '-',
      parseState: 'unparsed',
      validationErrors: []
    });
    expect(result.current.getRowsForPage(1)[0]?.name).toBe('原名称');
    expect(result.current.getSnapshot().rows[0]?.name).toBe('原名称');

    act(() => {
      blockedResult = result.current.runtime.finishEditing(requireSession(sessionId), 'enter');
    });

    expect(blockedResult).toEqual({
      status: 'blocked',
      errors: ['Value has not been parsed.']
    });
    expect(result.current.activeCell).toMatchObject({
      sessionId: requireSession(sessionId),
      parseState: 'unparsed'
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      result.current.runtime.setActiveDraft(requireSession(sessionId), '');
    });
    expect(result.current.activeCell).toMatchObject({
      draftValue: '',
      parseState: 'invalid'
    });
    expect(result.current.getRowsForPage(1)[0]?.name).toBe('原名称');
  });

  it('applies the virtualization detach commit and revert matrix', () => {
    const onChange = vi.fn();
    const blurMeta = resolveEditableCell({
      field: 'name',
      title: '名称',
      type: 'text',
      edit: { allowEmpty: false }
    });
    const explicitConfirmMeta = {
      ...blurMeta,
      commitMode: 'explicit-confirm' as const
    };
    const fields = new Map(editableFields);
    fields.set('name', blurMeta);
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '原名称', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;
    let finishResult: ReturnType<typeof result.current.runtime.finishEditing> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'name',
        field: 'name',
        initialValue: '原名称'
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), '虚拟卸载提交');
      finishResult = result.current.runtime.finishEditing(
        requireSession(sessionId),
        'virtualization-detach'
      );
    });

    expect(finishResult).toEqual({ status: 'committed' });
    expect(result.current.activeCell).toBeNull();
    expect(result.current.readyCell).toBeNull();
    expect(result.current.getSnapshot().rows[0]?.name).toBe('虚拟卸载提交');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'virtualization-detach' })
    );

    act(() => {
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row: result.current.getSnapshot().rows[0]!,
        columnId: 'name',
        field: 'name',
        initialValue: '虚拟卸载提交'
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), '', { parse: false });
      finishResult = result.current.runtime.finishEditing(
        requireSession(sessionId),
        'virtualization-detach'
      );
    });

    expect(finishResult).toEqual({
      status: 'reverted',
      reason: 'virtualization-detach',
      errors: ['Value has not been parsed.']
    });
    expect(result.current.activeCell).toBeNull();
    expect(result.current.readyCell).toBeNull();
    expect(onChange).toHaveBeenCalledOnce();

    act(() => {
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row: result.current.getSnapshot().rows[0]!,
        columnId: 'name',
        field: 'name',
        initialValue: '虚拟卸载提交',
        editableCell: explicitConfirmMeta
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), '不得隐式提交');
      finishResult = result.current.runtime.finishEditing(
        requireSession(sessionId),
        'virtualization-detach'
      );
    });

    expect(finishResult).toEqual({
      status: 'reverted',
      reason: 'virtualization-detach'
    });
    expect(result.current.activeCell).toBeNull();
    expect(result.current.getSnapshot().rows[0]?.name).toBe('虚拟卸载提交');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('reverts an explicit-confirm draft when another cell is selected', () => {
    const onChange = vi.fn();
    const blurMeta = resolveEditableCell({
      field: 'name',
      title: '名称',
      type: 'text',
      edit: { allowEmpty: false }
    });
    const explicitConfirmMeta = {
      ...blurMeta,
      commitMode: 'explicit-confirm' as const
    };
    const fields = new Map(editableFields);
    fields.set('name', blurMeta);
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '原名称', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'name',
        field: 'name',
        initialValue: '原名称',
        editableCell: explicitConfirmMeta
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), '不得隐式提交');
      result.current.runtime.selectCell({
        rowId: '1',
        row,
        columnId: 'status'
      });
    });

    expect(result.current.activeCell).toBeNull();
    expect(result.current.readyCell).toBeNull();
    expect(result.current.getSnapshot().rows[0]?.name).toBe('原名称');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cancels a detach when the same session anchor remounts in the microtask window', async () => {
    const onChange = vi.fn();
    const closePopup = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'name',
      resolveEditableCell({
        field: 'name',
        title: '名称',
        type: 'text',
        edit: { allowEmpty: false }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '原名称', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;
    let cleanupOldAnchor!: () => void;
    let cleanupCurrentAnchor!: () => void;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'name',
        field: 'name',
        initialValue: '原名称'
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), '重挂载后保留');
      cleanupOldAnchor = result.current.runtime.registerEditorAnchor(requireSession(sessionId), {
        closePopup
      });
      cleanupOldAnchor();
      cleanupCurrentAnchor = result.current.runtime.registerEditorAnchor(
        requireSession(sessionId),
        { closePopup }
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activeCell?.sessionId).toBe(requireSession(sessionId));
    expect(closePopup).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    act(() => cleanupOldAnchor());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.activeCell?.sessionId).toBe(requireSession(sessionId));

    act(() => cleanupCurrentAnchor());
    await act(async () => {
      await Promise.resolve();
    });

    expect(closePopup).toHaveBeenCalledOnce();
    expect(result.current.activeCell).toBeNull();
    expect(result.current.readyCell).toBeNull();
    expect(result.current.getSnapshot().rows[0]?.name).toBe('重挂载后保留');
    expect(onChange).toHaveBeenCalledOnce();
    expect(closePopup.mock.invocationCallOrder[0]).toBeLessThan(
      onChange.mock.invocationCallOrder[0]!
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'virtualization-detach' })
    );
  });

  it('ignores a stale anchor registration after a newer session mounts', async () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const row: Row = { id: 1, name: '原名称', status: 'DRAFT', roleIds: [1] };
    let staleSessionId: number | null = null;
    let currentSessionId: number | null = null;
    let cleanupStaleAnchor!: () => void;
    let cleanupCurrentAnchor!: () => void;

    act(() => {
      result.current.loadPage(1, [row]);
      staleSessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT'
      });
      currentSessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1]
      });
      result.current.runtime.setActiveDraft(requireSession(currentSessionId), [1, 2]);
      cleanupCurrentAnchor = result.current.runtime.registerEditorAnchor(
        requireSession(currentSessionId)
      );
      cleanupStaleAnchor = result.current.runtime.registerEditorAnchor(
        requireSession(staleSessionId)
      );
      cleanupCurrentAnchor();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activeCell).toBeNull();
    expect(result.current.getSnapshot().rows[0]?.roleIds).toEqual([1, 2]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'virtualization-detach' })
    );

    act(() => cleanupStaleAnchor());
    await act(async () => {
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not materialize an active input value as a committed draft during data reload', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'name',
      resolveEditableCell({
        field: 'name',
        title: '名称',
        type: 'text',
        edit: { allowEmpty: true, inputType: 'text' }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '旧名称', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'name',
        field: 'name',
        initialValue: '旧名称'
      });
    });
    act(() => {
      result.current.runtime.setActiveDraft(requireSession(sessionId), '新名称');
      result.current.loadPage(1, [row]);
      result.current.runtime.finishEditing(requireSession(sessionId), 'enter');
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'enter',
        changes: [
          {
            rowId: '1',
            field: 'name',
            previousValue: '旧名称',
            value: '新名称'
          }
        ]
      })
    );
  });

  it('allows a required input to be temporarily empty but rejects empty completion', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'name',
      resolveEditableCell({
        field: 'name',
        title: '名称',
        type: 'text',
        edit: { allowEmpty: false, inputType: 'text' }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '名称', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'name',
        field: 'name',
        initialValue: '名称'
      });
    });
    act(() => result.current.runtime.setActiveDraft(requireSession(sessionId), ''));
    expect(result.current.getRowsForPage(1)[0]?.name).toBe('名称');
    expect(result.current.getSnapshot().rows[0]?.name).toBe('名称');

    let finishResult: ReturnType<typeof result.current.runtime.finishEditing> | undefined;
    act(() => {
      finishResult = result.current.runtime.finishEditing(requireSession(sessionId), 'enter');
    });
    expect(finishResult).toEqual({
      status: 'reverted',
      reason: 'invalid-edit',
      errors: ['此项为必填项。']
    });
    expect(result.current.getRowsForPage(1)[0]?.name).toBe('名称');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not notify for unchanged completion and isolates a new query scope', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const firstRow: Row = {
      id: 1,
      name: '旧范围',
      status: 'DRAFT',
      roleIds: [1]
    };
    let sessionId: number | null = null;
    let finishResult: ReturnType<typeof result.current.runtime.finishEditing> | undefined;

    act(() => {
      result.current.loadScopePage('scope-a', 1, [firstRow]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row: firstRow,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT'
      });
      finishResult = result.current.runtime.finishEditing(requireSession(sessionId), 'enter');
    });
    expect(finishResult).toEqual({ status: 'unchanged' });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: 'READY' }
      });
      result.current.loadScopePage('scope-b', 1, [
        { id: 2, name: '新范围', status: 'DRAFT', roleIds: [2] }
      ]);
    });

    expect(result.current.getSnapshot()).toEqual({
      rows: [{ id: 2, name: '新范围', status: 'DRAFT', roleIds: [2] }],
      changedRows: [],
      changes: [],
      loadedPages: [1]
    });
  });

  it('rejects empty single and multiple values for non-empty fields', () => {
    const onChange = vi.fn();
    const requiredFields = new Map(editableFields);
    requiredFields.set(
      'status',
      resolveEditableCell({
        field: 'status',
        title: '状态',
        type: 'enum',
        edit: { selectionMode: 'single', allowEmpty: false },
        valueOptions: [
          { value: 'DRAFT', label: '草稿' },
          { value: 'READY', label: '就绪' }
        ]
      })
    );
    requiredFields.set(
      'roleIds',
      resolveEditableCell({
        field: 'roleIds',
        title: '角色',
        type: 'select',
        edit: { selectionMode: 'multiple', allowEmpty: false },
        valueOptions: [
          { value: 1, label: '管理员' },
          { value: 2, label: '审计员' }
        ]
      })
    );
    const { result } = renderEditing(onChange, requiredFields);
    const row: Row = {
      id: 1,
      name: '记录',
      status: 'DRAFT',
      roleIds: [1]
    };
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'typed-candidate', value: null }
      });
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1]
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), []);
      result.current.runtime.finishEditing(requireSession(sessionId), 'selection');
    });

    expect(result.current.getSnapshot()).toMatchObject({
      rows: [row],
      changedRows: [],
      changes: []
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('validates typed switch candidates before committing them', () => {
    const onChange = vi.fn();
    const switchMeta = resolveEditableCell({
      field: 'status',
      title: '状态',
      type: 'enum',
      valueOptions: [
        { value: 'DRAFT', label: '草稿' },
        { value: 'READY', label: '就绪' }
      ],
      edit: {
        control: 'switch',
        checkedValue: 'READY',
        uncheckedValue: 'DRAFT'
      }
    });
    const fields = new Map(editableFields);
    fields.set('status', switchMeta);
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let invalidResult: ReturnType<typeof result.current.runtime.commitCandidate> | undefined;
    let validResult: ReturnType<typeof result.current.runtime.commitCandidate> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      invalidResult = result.current.runtime.commitCandidate(
        {
          rowId: '1',
          row,
          columnId: 'status',
          field: 'status',
          value: 'INVALID',
          editableCell: switchMeta
        },
        'selection'
      );
    });

    expect(invalidResult).toEqual({
      status: 'blocked',
      errors: ['开关值必须与选中值或未选中值一致。']
    });
    expect(result.current.getSnapshot().rows).toEqual([row]);
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      validResult = result.current.runtime.commitCandidate(
        {
          rowId: '1',
          row,
          columnId: 'status',
          field: 'status',
          value: 'READY',
          editableCell: switchMeta
        },
        'selection'
      );
    });

    expect(validResult).toEqual({ status: 'committed' });
    expect(result.current.getSnapshot().rows[0]?.status).toBe('READY');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'selection' }));
  });

  it('routes raw and typed programmatic writes through the bound codec', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'name',
      resolveEditableCell({
        field: 'name',
        title: '名称',
        type: 'text',
        edit: { allowEmpty: false }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '旧名称', status: 'DRAFT', roleIds: [1] };
    let rawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let invalidTypedResult: ReturnType<typeof result.current.writeCell> | undefined;
    let missingCodecResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      rawResult = result.current.writeCell({
        rowId: '1',
        field: 'name',
        input: { kind: 'raw-draft', value: '123' }
      });
      invalidTypedResult = result.current.writeCell({
        rowId: '1',
        field: 'name',
        input: { kind: 'typed-candidate', value: 123 as never }
      });
      missingCodecResult = result.current.writeCell({
        rowId: '1',
        field: 'id',
        input: { kind: 'typed-candidate', value: 2 }
      });
    });

    expect(rawResult).toEqual({ status: 'committed' });
    expect(result.current.getSnapshot().rows[0]?.name).toBe('123');
    expect(typeof result.current.getSnapshot().rows[0]?.name).toBe('string');
    expect(invalidTypedResult).toEqual({
      status: 'blocked',
      errors: ['文本值必须是字符串。']
    });
    expect(missingCodecResult).toEqual({
      status: 'blocked',
      errors: ['目标编辑列不可用。']
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'programmatic',
        changes: [
          {
            rowId: '1',
            field: 'name',
            previousValue: '旧名称',
            value: '123'
          }
        ]
      })
    );
  });

  it('normalizes raw longText writes and validates typed candidates with the same codec', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'name',
      resolveEditableCell({
        field: 'name',
        title: '备注',
        type: 'longText',
        edit: {
          control: 'textarea',
          allowEmpty: false,
          maxLength: 5
        }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '原值', status: 'DRAFT', roleIds: [1] };
    let rawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let typedResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      rawResult = result.current.writeCell({
        rowId: '1',
        field: 'name',
        input: { kind: 'raw-draft', value: 'a\r\nb' }
      });
      typedResult = result.current.writeCell({
        rowId: '1',
        field: 'name',
        input: { kind: 'typed-candidate', value: '123456' }
      });
    });

    expect(rawResult).toEqual({ status: 'committed' });
    expect(typedResult).toEqual({
      status: 'blocked',
      errors: ['文本最多允许 5 个字符。']
    });
    expect(result.current.getSnapshot().rows[0]?.name).toBe('a\nb');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'programmatic' }));
  });

  it('uses the same numeric codec for raw and typed programmatic writes', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'amount',
      resolveEditableCell({
        field: 'amount',
        title: '金额',
        type: 'decimal',
        edit: {
          allowEmpty: true,
          emptyValue: null,
          min: 0,
          max: 100,
          step: 0.01,
          maxFractionDigits: 2
        }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = {
      id: 1,
      name: '记录',
      status: 'DRAFT',
      roleIds: [1],
      amount: 1
    };
    let rawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let invalidRawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let invalidTypedResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      rawResult = result.current.writeCell({
        rowId: '1',
        field: 'amount',
        input: { kind: 'raw-draft', value: '１２．３４' }
      });
      invalidRawResult = result.current.writeCell({
        rowId: '1',
        field: 'amount',
        input: { kind: 'raw-draft', value: '12.345' }
      });
      invalidTypedResult = result.current.writeCell({
        rowId: '1',
        field: 'amount',
        input: { kind: 'typed-candidate', value: 12.345 }
      });
    });

    expect(rawResult).toEqual({ status: 'committed' });
    expect(invalidRawResult).toEqual({
      status: 'blocked',
      errors: ['小数位最多允许 2 位。']
    });
    expect(invalidTypedResult).toEqual({
      status: 'blocked',
      errors: ['数值必须符合步长 0.01。']
    });
    expect(result.current.getSnapshot().rows[0]?.amount).toBe(12.34);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('uses the same strict date codec for raw and typed programmatic writes', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'effectiveDate',
      resolveEditableCell({
        field: 'effectiveDate',
        title: '生效日期',
        type: 'date',
        edit: {
          min: '2026-01-01',
          max: '2026-12-31',
          isDateUnavailable: (value) => value === '2026-07-31'
        }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = {
      id: 1,
      name: '记录',
      status: 'DRAFT',
      roleIds: [1],
      effectiveDate: '2026-07-30'
    };
    let rawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let invalidRawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let invalidTypedResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      rawResult = result.current.writeCell({
        rowId: '1',
        field: 'effectiveDate',
        input: { kind: 'raw-draft', value: '2026-08-01' }
      });
      invalidRawResult = result.current.writeCell({
        rowId: '1',
        field: 'effectiveDate',
        input: { kind: 'raw-draft', value: '2026-02-30' }
      });
      invalidTypedResult = result.current.writeCell({
        rowId: '1',
        field: 'effectiveDate',
        input: { kind: 'typed-candidate', value: '2026-07-31' }
      });
    });

    expect(rawResult).toEqual({ status: 'committed' });
    expect(invalidRawResult).toEqual({
      status: 'blocked',
      errors: ['日期格式必须为 YYYY-MM-DD。']
    });
    expect(invalidTypedResult).toEqual({
      status: 'blocked',
      errors: ['该日期不可选。']
    });
    expect(result.current.getSnapshot().rows[0]?.effectiveDate).toBe('2026-08-01');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('uses the bound time zone codec for raw and typed dateTime programmatic writes', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set(
      'executeAt',
      resolveEditableCell({
        field: 'executeAt',
        title: '执行时间',
        type: 'dateTime',
        tableId: 'orders',
        appTimeZone: 'Asia/Shanghai',
        edit: {
          valueKind: 'instant',
          granularity: 'minute',
          step: 5
        }
      })
    );
    const { result } = renderEditing(onChange, fields);
    const row: Row = {
      id: 1,
      name: '记录',
      status: 'DRAFT',
      roleIds: [1],
      executeAt: '2026-07-30T04:05:00.000Z'
    };
    let rawResult: ReturnType<typeof result.current.writeCell> | undefined;
    let invalidTypedResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      rawResult = result.current.writeCell({
        rowId: '1',
        field: 'executeAt',
        input: { kind: 'raw-draft', value: '2026-08-01T12:10' }
      });
      invalidTypedResult = result.current.writeCell({
        rowId: '1',
        field: 'executeAt',
        input: { kind: 'typed-candidate', value: '2026-08-01T04:11:00.000Z' }
      });
    });

    expect(rawResult).toEqual({ status: 'committed' });
    expect(invalidTypedResult).toEqual({
      status: 'blocked',
      errors: ['日期时间必须按 5 分钟递增。']
    });
    expect(result.current.getSnapshot().rows[0]?.executeAt).toBe('2026-08-01T04:10:00.000Z');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('blocks programmatic writes when the target is readonly', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange, editableFields, () => false);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let writeResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      writeResult = result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'raw-draft', value: 'READY' }
      });
    });

    expect(writeResult).toEqual({
      status: 'blocked',
      errors: ['目标单元格不可编辑。']
    });
    expect(result.current.getSnapshot().rows).toEqual([row]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fails closed when a programmatic target has no executable codec', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set('status', {
      ...fields.get('status')!,
      codec: undefined as never
    });
    const { result } = renderEditing(onChange, fields);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let writeResult: ReturnType<typeof result.current.writeCell> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      writeResult = result.current.writeCell({
        rowId: '1',
        field: 'status',
        input: { kind: 'raw-draft', value: 'READY' }
      });
    });

    expect(writeResult).toEqual({
      status: 'blocked',
      errors: ['目标单元格的编辑解析器不可用。']
    });
    expect(result.current.getSnapshot().rows).toEqual([row]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores stale session events after a different cell starts editing', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let statusSessionId: number | null = null;
    let roleSessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      statusSessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT'
      });
      result.current.runtime.setActiveDraft(requireSession(statusSessionId), 'READY');
      roleSessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1]
      });
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'blur' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.activeCell).toMatchObject({
      sessionId: requireSession(roleSessionId),
      columnId: 'roleIds'
    });

    let staleResult: ReturnType<typeof result.current.runtime.finishEditing> | undefined;
    act(() => {
      result.current.runtime.cancelEditing(requireSession(statusSessionId));
      staleResult = result.current.runtime.finishEditing(requireSession(statusSessionId), 'blur');
    });

    expect(staleResult).toEqual({ status: 'stale-session' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.activeCell).toMatchObject({
      sessionId: requireSession(roleSessionId),
      columnId: 'roleIds'
    });

    act(() => {
      result.current.runtime.setActiveDraft(requireSession(roleSessionId), [1, 2]);
      result.current.runtime.finishEditing(requireSession(roleSessionId), 'enter');
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'enter',
        changes: [
          {
            rowId: '1',
            field: 'roleIds',
            previousValue: [1],
            value: [1, 2]
          }
        ]
      })
    );
  });

  it('moves blur completion to one ready cell and clears it when another cell is selected', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT'
      });
      result.current.runtime.setActiveDraft(requireSession(sessionId), 'READY');
      result.current.runtime.finishEditing(requireSession(sessionId), 'blur');
    });

    expect(result.current.activeCell).toBeNull();
    expect(result.current.readyCell).toEqual({ rowId: '1', columnId: 'status' });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'blur' }));

    act(() => {
      result.current.runtime.selectCell({
        rowId: '1',
        row,
        columnId: 'roleIds'
      });
    });

    expect(result.current.readyCell).toBeNull();
  });

  it('moves cancellation to one ready cell and clears it when another cell is selected', () => {
    const { result } = renderEditing();
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let sessionId: number | null = null;

    act(() => {
      result.current.loadPage(1, [row]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT'
      });
      result.current.runtime.cancelEditing(requireSession(sessionId));
    });

    expect(result.current.activeCell).toBeNull();
    expect(result.current.readyCell).toEqual({ rowId: '1', columnId: 'status' });

    act(() => {
      result.current.runtime.selectCell({
        rowId: '1',
        row,
        columnId: 'roleIds'
      });
    });

    expect(result.current.readyCell).toBeNull();
  });

  it('applies an atomic batch with one revision change and one onChange event', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const rows: Row[] = [
      { id: 1, name: '第一行', status: 'DRAFT', roleIds: [1] },
      { id: 2, name: '第二行', status: 'DRAFT', roleIds: [2] }
    ];
    let batchResult: ReturnType<typeof result.current.runtime.applyBatch> | undefined;
    let revision = 0;

    act(() => {
      result.current.loadPage(1, rows);
      revision = result.current.runtime.getRevision();
      batchResult = result.current.runtime.applyBatch(
        {
          revision,
          commits: [
            {
              rowId: '1',
              columnId: 'status',
              field: 'status',
              value: 'READY',
              editableCell: editableFields.get('status')!
            },
            {
              rowId: '1',
              columnId: 'roleIds',
              field: 'roleIds',
              value: [2, 1],
              editableCell: editableFields.get('roleIds')!
            },
            {
              rowId: '2',
              columnId: 'status',
              field: 'status',
              value: 'READY',
              editableCell: editableFields.get('status')!
            }
          ]
        },
        'paste'
      );
    });

    expect(batchResult).toEqual({ status: 'committed' });
    expect(result.current.runtime.getRevision()).toBe(revision + 1);
    expect(result.current.getSnapshot().rows).toEqual([
      { id: 1, name: '第一行', status: 'READY', roleIds: [2, 1] },
      { id: 2, name: '第二行', status: 'READY', roleIds: [2] }
    ]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [
          {
            rowId: '1',
            field: 'status',
            previousValue: 'DRAFT',
            value: 'READY'
          },
          {
            rowId: '1',
            field: 'roleIds',
            previousValue: [1],
            value: [2, 1]
          },
          {
            rowId: '2',
            field: 'status',
            previousValue: 'DRAFT',
            value: 'READY'
          }
        ]
      })
    );
  });

  it('rejects a stale batch without applying any additional changes', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let staleRevision = 0;
    let batchResult: ReturnType<typeof result.current.runtime.applyBatch> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      staleRevision = result.current.runtime.getRevision();
      result.current.writeCell({
        rowId: '1',
        field: 'roleIds',
        input: { kind: 'typed-candidate', value: [2] }
      });
      batchResult = result.current.runtime.applyBatch(
        {
          revision: staleRevision,
          commits: [
            {
              rowId: '1',
              columnId: 'status',
              field: 'status',
              value: 'READY',
              editableCell: editableFields.get('status')!
            }
          ]
        },
        'paste'
      );
    });

    expect(batchResult).toEqual({
      status: 'blocked',
      errors: ['批量操作计划已过期，请重试。']
    });
    expect(result.current.getSnapshot().rows[0]).toEqual({
      ...row,
      roleIds: [2]
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('preflights every batch target and keeps zero writes on failure', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(
      onChange,
      editableFields,
      ({ columnId }) => columnId !== 'roleIds'
    );
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let batchResult: ReturnType<typeof result.current.runtime.applyBatch> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      batchResult = result.current.runtime.applyBatch(
        {
          revision: result.current.runtime.getRevision(),
          commits: [
            {
              rowId: '1',
              columnId: 'status',
              field: 'status',
              value: 'READY',
              editableCell: editableFields.get('status')!
            },
            {
              rowId: '1',
              columnId: 'roleIds',
              field: 'roleIds',
              value: [2],
              editableCell: editableFields.get('roleIds')!
            }
          ]
        },
        'paste'
      );
    });

    expect(batchResult).toEqual({
      status: 'blocked',
      errors: ['目标单元格不可编辑。']
    });
    expect(result.current.getSnapshot().rows).toEqual([row]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks a batch while an editing session is active', () => {
    const onChange = vi.fn();
    const { result } = renderEditing(onChange);
    const row: Row = { id: 1, name: '记录', status: 'DRAFT', roleIds: [1] };
    let batchResult: ReturnType<typeof result.current.runtime.applyBatch> | undefined;

    act(() => {
      result.current.loadPage(1, [row]);
      result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT'
      });
      batchResult = result.current.runtime.applyBatch(
        {
          revision: result.current.runtime.getRevision(),
          commits: [
            {
              rowId: '1',
              columnId: 'roleIds',
              field: 'roleIds',
              value: [2],
              editableCell: editableFields.get('roleIds')!
            }
          ]
        },
        'paste'
      );
    });

    expect(batchResult).toEqual({
      status: 'blocked',
      errors: ['请先完成当前单元格编辑，再执行批量操作。']
    });
    expect(result.current.getSnapshot().rows).toEqual([row]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
