import { describe, expect, it } from 'vitest';

import {
  resolveDataTableEditableCell,
  type ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-adapters';
import type { DataTableEditableColumnMeta } from '../types';

import {
  prepareDataTableFillPlan,
  resolveDataTableFillTarget,
  type DataTableFillColumn,
  type DataTableFillRow
} from './data-table-fill-plan';

type Row = {
  id: string;
  sourceA: string;
  sourceB: string;
  targetA: string;
  targetB: string;
  amount: number | null;
  requiredText: string;
};

function resolveEditableCell(
  context: ResolveDataTableEditableCellContext<Row>
): DataTableEditableColumnMeta<Row> {
  const resolved = resolveDataTableEditableCell(context);
  if (!resolved) throw new Error(`Missing editable adapter for ${context.type}.`);
  return resolved.columnMeta.editableCell;
}

function textCell(field: keyof Row & string, allowEmpty = true) {
  return resolveEditableCell({
    field,
    title: field,
    type: 'text',
    edit: { allowEmpty }
  });
}

function createRows(): DataTableFillRow<Row>[] {
  return [
    {
      rowId: '1',
      row: {
        id: '1',
        sourceA: 'A1',
        sourceB: 'B1',
        targetA: '',
        targetB: '',
        amount: null,
        requiredText: 'required-1'
      }
    },
    {
      rowId: '2',
      row: {
        id: '2',
        sourceA: 'A2',
        sourceB: 'B2',
        targetA: '',
        targetB: '',
        amount: null,
        requiredText: 'required-2'
      }
    },
    {
      rowId: '3',
      row: {
        id: '3',
        sourceA: 'A3',
        sourceB: 'B3',
        targetA: '',
        targetB: '',
        amount: null,
        requiredText: 'required-3'
      }
    },
    {
      rowId: '4',
      row: {
        id: '4',
        sourceA: 'A4',
        sourceB: 'B4',
        targetA: '',
        targetB: '',
        amount: null,
        requiredText: 'required-4'
      }
    }
  ];
}

function createTextColumns(): DataTableFillColumn<Row>[] {
  return [
    { columnId: 'sourceA', visible: true, editableCell: textCell('sourceA') },
    { columnId: 'sourceB', visible: true, editableCell: textCell('sourceB') },
    { columnId: 'targetA', visible: true, editableCell: textCell('targetA') },
    { columnId: 'targetB', visible: true, editableCell: textCell('targetB') }
  ];
}

describe('resolveDataTableFillTarget', () => {
  const source = { rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 };

  it.each([
    {
      coordinate: { rowIndex: 4, columnIndex: 2 },
      expected: {
        direction: 'down',
        targetBounds: { rowStart: 3, rowEnd: 4, columnStart: 1, columnEnd: 2 }
      }
    },
    {
      coordinate: { rowIndex: 0, columnIndex: 1 },
      expected: {
        direction: 'up',
        targetBounds: { rowStart: 0, rowEnd: 0, columnStart: 1, columnEnd: 2 }
      }
    },
    {
      coordinate: { rowIndex: 2, columnIndex: 4 },
      expected: {
        direction: 'right',
        targetBounds: { rowStart: 1, rowEnd: 2, columnStart: 3, columnEnd: 4 }
      }
    },
    {
      coordinate: { rowIndex: 1, columnIndex: 0 },
      expected: {
        direction: 'left',
        targetBounds: { rowStart: 1, rowEnd: 2, columnStart: 0, columnEnd: 0 }
      }
    },
    {
      coordinate: { rowIndex: 4, columnIndex: 4 },
      expected: {
        direction: 'down-right',
        targetBounds: { rowStart: 1, rowEnd: 4, columnStart: 1, columnEnd: 4 }
      }
    },
    {
      coordinate: { rowIndex: 0, columnIndex: 0 },
      expected: {
        direction: 'up-left',
        targetBounds: { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 }
      }
    },
    {
      coordinate: { rowIndex: 0, columnIndex: 4 },
      expected: {
        direction: 'up-right',
        targetBounds: { rowStart: 0, rowEnd: 2, columnStart: 1, columnEnd: 4 }
      }
    },
    {
      coordinate: { rowIndex: 4, columnIndex: 0 },
      expected: {
        direction: 'down-left',
        targetBounds: { rowStart: 1, rowEnd: 4, columnStart: 0, columnEnd: 2 }
      }
    }
  ])('resolves a $expected.direction extension', ({ coordinate, expected }) => {
    expect(resolveDataTableFillTarget(source, coordinate)).toEqual(expected);
  });

  it('rejects a coordinate inside the source', () => {
    expect(resolveDataTableFillTarget(source, { rowIndex: 1, columnIndex: 1 })).toBeNull();
  });
});

describe('prepareDataTableFillPlan', () => {
  it('copies one value across an adjacent target range', async () => {
    const plan = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: createTextColumns(),
      sourceBounds: { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 },
      targetBounds: { rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 0 },
      revision: 1,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('ready');
    expect(plan.operations.map((operation) => operation.value)).toEqual(['A1', 'A1', 'A1']);
  });

  it('repeats a 2x2 rectangle vertically into one immutable ready plan', async () => {
    const plan = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: createTextColumns(),
      sourceBounds: { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
      targetBounds: { rowStart: 2, rowEnd: 3, columnStart: 0, columnEnd: 1 },
      revision: 4,
      isCellEditable: () => true
    });

    expect(plan).toEqual(
      expect.objectContaining({
        status: 'ready',
        direction: 'down',
        revision: 4,
        fillSourceShape: { rows: 2, columns: 2, cells: 4 },
        fillTargetShape: { rows: 2, columns: 2, cells: 4 }
      })
    );
    expect(plan.operations.map((operation) => operation.value)).toEqual(['A1', 'B1', 'A2', 'B2']);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.operations)).toBe(true);
  });

  it('repeats one source column horizontally and supports reverse fill', async () => {
    const horizontal = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: createTextColumns(),
      sourceBounds: { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 0 },
      targetBounds: { rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 3 },
      revision: 1,
      isCellEditable: () => true
    });
    expect(horizontal.status).toBe('ready');
    expect(horizontal.operations.map((operation) => operation.value)).toEqual([
      'A1',
      'A1',
      'A1',
      'A2',
      'A2',
      'A2'
    ]);

    const reverse = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: createTextColumns(),
      sourceBounds: { rowStart: 2, rowEnd: 3, columnStart: 0, columnEnd: 1 },
      targetBounds: { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
      revision: 2,
      isCellEditable: () => true
    });
    expect(reverse.status).toBe('ready');
    expect(reverse.direction).toBe('up');
    expect(reverse.operations.map((operation) => operation.value)).toEqual([
      'A3',
      'B3',
      'A4',
      'B4'
    ]);
  });

  it('repeats a 2x2 rectangle diagonally into the expanded region without rewriting the source', async () => {
    const plan = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: createTextColumns(),
      sourceBounds: { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
      targetBounds: { rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 3 },
      revision: 5,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('ready');
    expect(plan.direction).toBe('down-right');
    expect(plan.fillSourceShape).toEqual({ rows: 2, columns: 2, cells: 4 });
    expect(plan.fillTargetShape).toEqual({ rows: 4, columns: 4, cells: 16 });
    // 12 fill cells = the full 4x4 expansion minus the 2x2 source block.
    expect(plan.operations).toHaveLength(12);
    expect(plan.operations.map((operation) => operation.value)).toEqual([
      'A1',
      'B1',
      'A2',
      'B2',
      'A1',
      'B1',
      'A1',
      'B1',
      'A2',
      'B2',
      'A2',
      'B2'
    ]);
    // Source cells (rows 0-1, columns 0-1) must never be touched by the fill.
    for (const operation of plan.operations) {
      const insideSource =
        operation.target.rowIndex >= 0 &&
        operation.target.rowIndex <= 1 &&
        operation.target.columnIndex >= 0 &&
        operation.target.columnIndex <= 1;
      expect(insideSource).toBe(false);
    }
  });

  it('repeats numeric source values without inferring a sequence', async () => {
    const rows = createRows();
    rows[0]!.row.amount = 1;
    rows[1]!.row.amount = 2;
    const columns: DataTableFillColumn<Row>[] = [
      {
        columnId: 'amount',
        visible: true,
        editableCell: resolveEditableCell({
          field: 'amount',
          title: '金额',
          type: 'decimal',
          edit: { allowEmpty: true, emptyValue: null, maxFractionDigits: 2 }
        })
      }
    ];
    const plan = await prepareDataTableFillPlan({
      rows,
      columns,
      sourceBounds: { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 0 },
      targetBounds: { rowStart: 2, rowEnd: 3, columnStart: 0, columnEnd: 0 },
      revision: 1,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('ready');
    expect(plan.operations.map((operation) => operation.value)).toEqual([1, 2]);
  });

  it('fails closed for a non-adjacent or irregular target shape', async () => {
    const plan = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: createTextColumns(),
      sourceBounds: { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
      targetBounds: { rowStart: 2, rowEnd: 3, columnStart: 1, columnEnd: 2 },
      revision: 1,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('invalid');
    expect(plan.operations).toHaveLength(0);
    expect(plan.failures).toEqual([
      expect.objectContaining({
        code: 'invalid-fill-shape',
        errors: ['填充区域必须紧邻源区域，并沿其整条边或对角连续向外扩展。']
      })
    ]);
  });

  it('revalidates source text through the numeric target codec and reports coordinates', async () => {
    const rows = createRows();
    rows[0]!.row.sourceA = 'not-a-number';
    const columns: DataTableFillColumn<Row>[] = [
      { columnId: 'sourceA', visible: true, editableCell: textCell('sourceA') },
      {
        columnId: 'amount',
        visible: true,
        editableCell: resolveEditableCell({
          field: 'amount',
          title: '金额',
          type: 'decimal',
          edit: { allowEmpty: true, emptyValue: null, maxFractionDigits: 2 }
        })
      }
    ];
    const plan = await prepareDataTableFillPlan({
      rows,
      columns,
      sourceBounds: { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 },
      targetBounds: { rowStart: 0, rowEnd: 0, columnStart: 1, columnEnd: 1 },
      revision: 8,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('invalid');
    expect(plan.failures).toEqual([
      expect.objectContaining({
        code: 'parse',
        source: { rowIndex: 0, columnIndex: 0, columnId: 'sourceA' },
        target: expect.objectContaining({
          rowIndex: 0,
          columnIndex: 1,
          rowId: '1',
          columnId: 'amount'
        })
      })
    ]);
  });

  it.each([
    {
      name: 'readonly',
      columns: createTextColumns(),
      rightPinnedColumnIds: [] as string[],
      targetBounds: { rowStart: 0, rowEnd: 0, columnStart: 1, columnEnd: 1 },
      isCellEditable: () => false,
      expectedCode: 'readonly'
    },
    {
      name: 'pinned boundary',
      columns: createTextColumns().slice(0, 1),
      rightPinnedColumnIds: ['sourceB'],
      targetBounds: { rowStart: 0, rowEnd: 0, columnStart: 1, columnEnd: 1 },
      isCellEditable: () => true,
      expectedCode: 'pinned-column-excluded'
    },
    {
      name: 'hidden target',
      columns: createTextColumns().map((column, index) =>
        index === 1 ? { ...column, visible: false } : column
      ),
      rightPinnedColumnIds: [] as string[],
      targetBounds: { rowStart: 0, rowEnd: 0, columnStart: 1, columnEnd: 1 },
      isCellEditable: () => true,
      expectedCode: 'hidden-column'
    }
  ])('keeps zero operations for a $name failure', async (testCase) => {
    const plan = await prepareDataTableFillPlan({
      rows: createRows(),
      columns: testCase.columns,
      rightPinnedColumnIds: testCase.rightPinnedColumnIds,
      sourceBounds: { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 },
      targetBounds: testCase.targetBounds,
      revision: 1,
      isCellEditable: testCase.isCellEditable
    });

    expect(plan.status).toBe('invalid');
    expect(plan.failures[0]?.code).toBe(testCase.expectedCode);
  });

  it('fails required target validation for an empty source without exposing partial writes', async () => {
    const rows = createRows();
    rows[0]!.row.sourceA = '';
    const columns: DataTableFillColumn<Row>[] = [
      { columnId: 'sourceA', visible: true, editableCell: textCell('sourceA') },
      {
        columnId: 'requiredText',
        visible: true,
        editableCell: textCell('requiredText', false)
      }
    ];
    const plan = await prepareDataTableFillPlan({
      rows,
      columns,
      sourceBounds: { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 },
      targetBounds: { rowStart: 0, rowEnd: 0, columnStart: 1, columnEnd: 1 },
      revision: 1,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('invalid');
    expect(plan.operations).toHaveLength(0);
    expect(plan.failures[0]).toEqual(expect.objectContaining({ code: 'validate' }));
  });
});
