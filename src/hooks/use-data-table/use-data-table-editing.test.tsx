import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DataTableEditableColumnMeta } from '@/types/data-table';

import { useDataTableEditing } from './use-data-table-editing';

type Row = {
  id: number;
  name: string;
  status: 'DRAFT' | 'READY' | null;
  roleIds: number[];
};

const editableFields = new Map<keyof Row & string, DataTableEditableColumnMeta<Row>>([
  [
    'status',
    {
      field: 'status',
      title: '状态',
      type: 'enum',
      selectionMode: 'single',
      allowEmpty: true,
      valueOptions: [
        { value: 'DRAFT', label: '草稿' },
        { value: 'READY', label: '就绪' }
      ]
    }
  ],
  [
    'roleIds',
    {
      field: 'roleIds',
      title: '角色',
      type: 'select',
      selectionMode: 'multiple',
      allowEmpty: true,
      valueOptions: [
        { value: 1, label: '管理员' },
        { value: 2, label: '审计员' }
      ]
    }
  ]
]);

function renderEditing(
  onChange = vi.fn(),
  fields: ReadonlyMap<keyof Row & string, DataTableEditableColumnMeta<Row>> = editableFields
) {
  return renderHook(() =>
    useDataTableEditing<Row>({
      tableId: 'editing-test',
      editableFields: fields,
      getRowId: (row) => String(row.id),
      options: { onChange }
    })
  );
}

function requireSession(sessionId: number | null): number {
  if (sessionId === null) throw new Error('editing session was not started');
  return sessionId;
}

describe('useDataTableEditing', () => {
  it('merges drafts across loaded pages into an ordered snapshot', () => {
    const { result } = renderEditing();

    act(() => {
      result.current.loadPage(2, [{ id: 2, name: '第二页', status: 'DRAFT', roleIds: [2] }]);
      result.current.loadPage(1, [{ id: 1, name: '第一页', status: 'DRAFT', roleIds: [1] }]);
      result.current.updateCell({
        rowId: '1',
        field: 'status',
        value: 'READY',
        reason: 'selection'
      });
      result.current.updateCell({
        rowId: '2',
        field: 'roleIds',
        value: [2, 1],
        reason: 'selection'
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
      result.current.updateCell({
        rowId: '1',
        field: 'status',
        value: 'READY',
        reason: 'selection'
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
      result.current.updateCell({
        rowId: '1',
        field: 'status',
        value: 'READY',
        reason: 'selection'
      });
    });
    const submitted = result.current.getSnapshot().changes;

    act(() => {
      result.current.updateCell({
        rowId: '1',
        field: 'status',
        value: null,
        reason: 'selection'
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
      result.current.updateCell({
        rowId: '1',
        field: 'roleIds',
        value: [1, 2],
        reason: 'selection'
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
        initialValue: [1],
        value: [1]
      });
    });
    act(() => result.current.runtime.setActiveValue(requireSession(sessionId), [1, 2]));

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

    act(() => result.current.runtime.finishEditing(requireSession(sessionId), 'enter'));
    expect(result.current.getSnapshot().changedRows[0]).toMatchObject({
      id: 1,
      roleIds: [1, 2]
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'enter' }));
  });

  it('does not materialize an active input value as a committed draft during data reload', () => {
    const onChange = vi.fn();
    const fields = new Map(editableFields);
    fields.set('name', {
      field: 'name',
      title: '名称',
      editor: 'input',
      allowEmpty: true,
      inputType: 'text'
    });
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
        initialValue: '旧名称',
        value: '旧名称'
      });
    });
    act(() => {
      result.current.runtime.setActiveValue(requireSession(sessionId), '新名称');
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
    fields.set('name', {
      field: 'name',
      title: '名称',
      editor: 'input',
      allowEmpty: false,
      inputType: 'text'
    });
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
        initialValue: '名称',
        value: '名称'
      });
    });
    act(() => result.current.runtime.setActiveValue(requireSession(sessionId), ''));
    expect(result.current.getRowsForPage(1)[0]?.name).toBe('');
    expect(result.current.getSnapshot().rows[0]?.name).toBe('名称');

    act(() => result.current.runtime.finishEditing(requireSession(sessionId), 'enter'));
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

    act(() => {
      result.current.loadScopePage('scope-a', 1, [firstRow]);
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row: firstRow,
        columnId: 'status',
        field: 'status',
        initialValue: 'DRAFT',
        value: 'DRAFT'
      });
      result.current.runtime.finishEditing(requireSession(sessionId), 'enter');
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      result.current.updateCell({
        rowId: '1',
        field: 'status',
        value: 'READY',
        reason: 'programmatic'
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
    requiredFields.set('status', {
      ...requiredFields.get('status')!,
      allowEmpty: false
    });
    requiredFields.set('roleIds', {
      ...requiredFields.get('roleIds')!,
      allowEmpty: false
    });
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
      result.current.updateCell({
        rowId: '1',
        field: 'status',
        value: null,
        reason: 'programmatic'
      });
      sessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1],
        value: [1]
      });
      result.current.runtime.setActiveValue(requireSession(sessionId), []);
      result.current.runtime.finishEditing(requireSession(sessionId), 'selection');
    });

    expect(result.current.getSnapshot()).toMatchObject({
      rows: [row],
      changedRows: [],
      changes: []
    });
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
        initialValue: 'DRAFT',
        value: 'DRAFT'
      });
      result.current.runtime.setActiveValue(requireSession(statusSessionId), 'READY');
      roleSessionId = result.current.runtime.startEditing({
        rowId: '1',
        row,
        columnId: 'roleIds',
        field: 'roleIds',
        initialValue: [1],
        value: [1]
      });
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'blur' }));
    expect(result.current.activeCell).toMatchObject({
      sessionId: requireSession(roleSessionId),
      columnId: 'roleIds'
    });

    act(() => {
      result.current.runtime.cancelEditing(requireSession(statusSessionId));
      result.current.runtime.finishEditing(requireSession(statusSessionId), 'blur');
    });

    expect(result.current.activeCell).toMatchObject({
      sessionId: requireSession(roleSessionId),
      columnId: 'roleIds'
    });
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
        initialValue: 'DRAFT',
        value: 'DRAFT'
      });
      result.current.runtime.setActiveValue(requireSession(sessionId), 'READY');
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
        initialValue: 'DRAFT',
        value: 'DRAFT'
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
});
