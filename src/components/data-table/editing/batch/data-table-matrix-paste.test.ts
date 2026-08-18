import { describe, expect, it, vi } from 'vitest';

import {
  resolveDataTableEditableCell,
  type ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-adapters';
import type { DataTableEditableColumnMeta } from '../types';

import { escapeDataTableCellClipboardText } from '../../selection/data-table-cell-range';
import syntheticExcelFixture from './fixtures/phase-6-synthetic-excel-clipboard.json';
import {
  parseDataTableClipboardMatrix,
  prepareDataTableMatrixPaste,
  type DataTableMatrixPasteColumn,
  type DataTableMatrixPasteRow
} from './data-table-matrix-paste';

type FixtureSample = (typeof syntheticExcelFixture.samples)[number];

type Row = {
  id: string;
  code: string;
  name: string;
  amount: number | null;
  effectiveDate: string | null;
  note: string;
  status: 'DRAFT' | 'READY' | null;
};

function getFixtureSample(id: string): FixtureSample {
  const sample = syntheticExcelFixture.samples.find((candidate) => candidate.id === id);
  if (!sample) throw new Error(`Missing synthetic Excel fixture ${id}.`);
  return sample;
}

function resolveEditableCell(
  context: ResolveDataTableEditableCellContext<Row>
): DataTableEditableColumnMeta<Row> {
  const resolved = resolveDataTableEditableCell(context);
  if (!resolved) throw new Error(`Missing editable adapter for ${context.type}.`);
  return resolved.columnMeta.editableCell;
}

const textCell = (field: keyof Row & string, title: string) =>
  resolveEditableCell({
    field,
    title,
    type: 'text',
    edit: { allowEmpty: true }
  });

function createRows(count = 3): DataTableMatrixPasteRow<Row>[] {
  return Array.from({ length: count }, (_, index) => ({
    rowId: String(index + 1),
    row: {
      id: String(index + 1),
      code: '',
      name: '',
      amount: null,
      effectiveDate: null,
      note: '',
      status: 'DRAFT'
    }
  }));
}

function createTypedColumns(): DataTableMatrixPasteColumn<Row>[] {
  return [
    {
      columnId: 'code',
      visible: true,
      editableCell: textCell('code', '编号')
    },
    {
      columnId: 'name',
      visible: true,
      editableCell: textCell('name', '姓名')
    },
    {
      columnId: 'amount',
      visible: true,
      editableCell: resolveEditableCell({
        field: 'amount',
        title: '金额',
        type: 'decimal',
        edit: {
          allowEmpty: true,
          emptyValue: null,
          min: 0,
          max: 10_000,
          step: 0.01,
          maxFractionDigits: 2
        }
      })
    },
    {
      columnId: 'effectiveDate',
      visible: true,
      editableCell: resolveEditableCell({
        field: 'effectiveDate',
        title: '生效日期',
        type: 'date',
        edit: {
          min: '2026-01-01',
          max: '2026-12-31'
        }
      })
    },
    {
      columnId: 'note',
      visible: true,
      editableCell: resolveEditableCell({
        field: 'note',
        title: '备注',
        type: 'longText',
        edit: {
          control: 'textarea',
          allowEmpty: true
        }
      })
    }
  ];
}

describe('parseDataTableClipboardMatrix', () => {
  it.each(syntheticExcelFixture.samples)(
    'parses the approved synthetic Excel-compatible fixture $id',
    (sample) => {
      expect(parseDataTableClipboardMatrix(sample.clipboardText)).toEqual({
        status: 'valid',
        matrix: sample.expectedMatrix,
        rowCount: sample.expectedMatrix.length,
        columnCount: sample.expectedMatrix[0]?.length ?? 0,
        cellCount: sample.expectedMatrix.length * (sample.expectedMatrix[0]?.length ?? 0)
      });
    }
  );

  it('rejects malformed quotes and non-rectangular clipboard data', () => {
    expect(parseDataTableClipboardMatrix('1\t"unterminated')).toEqual({
      status: 'invalid',
      code: 'clipboard-syntax',
      errors: ['剪贴板中存在未闭合引号的单元格。']
    });
    expect(parseDataTableClipboardMatrix('1\t2\r\n3')).toEqual({
      status: 'invalid',
      code: 'non-rectangular',
      errors: ['剪贴板每行的单元格数量必须一致。']
    });
  });

  it('rejects a matrix above the configured cell limit', () => {
    expect(parseDataTableClipboardMatrix('1\t2\r\n3\t4', { maxCells: 3 })).toEqual({
      status: 'invalid',
      code: 'too-many-cells',
      errors: ['剪贴板包含 4 个单元格，最多允许 3 个。']
    });
  });
});

describe('prepareDataTableMatrixPaste', () => {
  it('collects every typed failure before returning an atomic invalid plan', async () => {
    const sample = getFixtureSample('E01');
    const plan = await prepareDataTableMatrixPaste({
      clipboardText: sample.clipboardText,
      rows: createRows(),
      columns: createTypedColumns(),
      anchor: { rowIndex: 0, columnIndex: 0 },
      revision: 7,
      isCellEditable: () => true,
      yieldControl: vi.fn(async () => undefined)
    });

    expect(plan.status).toBe('invalid');
    expect(plan.revision).toBe(7);
    expect(plan.sourceShape).toEqual({ rows: 3, columns: 5, cells: 15 });
    expect(plan.failures).toEqual([
      expect.objectContaining({
        code: 'parse',
        source: { rowIndex: 1, columnIndex: 2 },
        target: expect.objectContaining({
          rowIndex: 1,
          columnIndex: 2,
          rowId: '2',
          columnId: 'amount'
        })
      }),
      expect.objectContaining({
        code: 'validate',
        source: { rowIndex: 1, columnIndex: 3 },
        target: expect.objectContaining({
          rowIndex: 1,
          columnIndex: 3,
          rowId: '2',
          columnId: 'effectiveDate'
        })
      })
    ]);
    expect(plan.operations).toHaveLength(11);
    expect(plan.skipped).toHaveLength(2);
  });

  it('keeps a quoted multiline textarea value in one ready operation', async () => {
    const sample = getFixtureSample('E02');
    const rows = createRows(2);
    const columns: DataTableMatrixPasteColumn<Row>[] = [
      {
        columnId: 'code',
        visible: true,
        editableCell: textCell('code', '编号')
      },
      {
        columnId: 'note',
        visible: true,
        editableCell: resolveEditableCell({
          field: 'note',
          title: '备注',
          type: 'longText',
          edit: { control: 'textarea', allowEmpty: true }
        })
      },
      {
        columnId: 'status',
        visible: true,
        editableCell: resolveEditableCell({
          field: 'status',
          title: '状态',
          type: 'enum',
          edit: { selectionMode: 'single', allowEmpty: true },
          valueOptions: [
            { value: 'DRAFT', label: '草稿' },
            { value: 'READY', label: '就绪' }
          ]
        })
      }
    ];

    const plan = await prepareDataTableMatrixPaste({
      clipboardText: sample.clipboardText,
      rows,
      columns,
      anchor: { rowIndex: 0, columnIndex: 0 },
      revision: 3,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('ready');
    expect(plan.operations).toHaveLength(5);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.operations[1]).toEqual(
      expect.objectContaining({
        value: '第一行\n第二行，含 "双引号"',
        source: { rowIndex: 0, columnIndex: 1 }
      })
    );
  });

  const boundaryColumns: DataTableMatrixPasteColumn<Row>[] = [
    {
      columnId: 'code',
      visible: true,
      editableCell: textCell('code', '编号')
    },
    {
      columnId: 'name',
      visible: true,
      editableCell: textCell('name', '名称')
    },
    {
      columnId: 'note',
      visible: true,
      editableCell: textCell('note', '备注')
    }
  ];

  it.each([
    {
      name: 'readonly',
      rows: createRows(2),
      columns: boundaryColumns,
      rightPinnedColumnIds: [],
      isCellEditable: ({ columnId }: { columnId: string }) => columnId !== 'name',
      expectedCode: 'readonly',
      expectedFailures: 2
    },
    {
      name: 'out of bounds',
      rows: createRows(1),
      columns: boundaryColumns,
      rightPinnedColumnIds: [],
      isCellEditable: () => true,
      expectedCode: 'out-of-bounds',
      expectedFailures: 3
    },
    {
      name: 'pinned boundary',
      rows: createRows(2),
      columns: boundaryColumns.slice(0, 2),
      rightPinnedColumnIds: ['note'],
      isCellEditable: () => true,
      expectedCode: 'pinned-column-excluded',
      expectedFailures: 2
    },
    {
      name: 'hidden column',
      rows: createRows(2),
      columns: boundaryColumns.map((column, index) =>
        index === 1 ? { ...column, visible: false } : column
      ),
      rightPinnedColumnIds: [],
      isCellEditable: () => true,
      expectedCode: 'hidden-column',
      expectedFailures: 2
    }
  ])('fails closed for an E03 $name target', async (testCase) => {
    const sample = getFixtureSample('E03');
    const plan = await prepareDataTableMatrixPaste({
      clipboardText: sample.clipboardText,
      rows: testCase.rows,
      columns: testCase.columns,
      rightPinnedColumnIds: testCase.rightPinnedColumnIds,
      anchor: { rowIndex: 0, columnIndex: 0 },
      revision: 1,
      isCellEditable: testCase.isCellEditable
    });

    expect(plan.status).toBe('invalid');
    expect(plan.failures).toHaveLength(testCase.expectedFailures);
    expect(plan.failures.every((failure) => failure.code === testCase.expectedCode)).toBe(true);
    expect(plan.failures.every((failure) => failure.source !== undefined)).toBe(true);
  });

  it('yields while preparing 10k cells and supports cancellation', async () => {
    type WideRow = { id: string } & Record<string, unknown>;
    const editableCell = resolveDataTableEditableCell<WideRow>({
      field: 'column-0',
      title: 'Value',
      type: 'text',
      edit: { allowEmpty: true }
    })!.columnMeta.editableCell;
    const rows: DataTableMatrixPasteRow<WideRow>[] = Array.from({ length: 100 }, (_, rowIndex) => ({
      rowId: String(rowIndex),
      row: Object.fromEntries([
        ['id', String(rowIndex)],
        ...Array.from({ length: 100 }, (_, columnIndex) => [`column-${columnIndex}`, ''])
      ]) as WideRow
    }));
    const columns: DataTableMatrixPasteColumn<WideRow>[] = Array.from(
      { length: 100 },
      (_, columnIndex) => ({
        columnId: `column-${columnIndex}`,
        visible: true,
        editableCell: {
          ...editableCell,
          field: `column-${columnIndex}`
        }
      })
    );
    const clipboardText = Array.from({ length: 100 }, () =>
      Array.from({ length: 100 }, () => 'value').join('\t')
    ).join('\r\n');
    const yieldControl = vi.fn(async () => undefined);

    const plan = await prepareDataTableMatrixPaste({
      clipboardText,
      rows,
      columns,
      anchor: { rowIndex: 0, columnIndex: 0 },
      revision: 1,
      isCellEditable: () => true,
      yieldEvery: 250,
      yieldControl
    });

    expect(plan.status).toBe('ready');
    expect(plan.operations).toHaveLength(10_000);
    expect(yieldControl).toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort();
    const abortedPlan = await prepareDataTableMatrixPaste({
      clipboardText: 'value',
      rows: rows.slice(0, 1),
      columns: columns.slice(0, 1),
      anchor: { rowIndex: 0, columnIndex: 0 },
      revision: 1,
      isCellEditable: () => true,
      signal: controller.signal
    });
    expect(abortedPlan).toEqual(
      expect.objectContaining({
        status: 'invalid',
        failures: [expect.objectContaining({ code: 'aborted' })]
      })
    );
  });

  it('preserves domain values through copy and matrix paste for every V1 editor family', async () => {
    type RoundTripRow = {
      id: string;
      text: string;
      enumValue: 'DRAFT' | 'READY';
      selectedValues: number[];
      remoteValue: string;
      longText: string;
      numberValue: number;
      intValue: number;
      decimalValue: number;
      moneyValue: number;
      percentValue: number;
      dateValue: string;
      dateTimeValue: string;
    };
    const row: RoundTripRow = {
      id: '1',
      text: '文本',
      enumValue: 'READY',
      selectedValues: [1, 2],
      remoteValue: 'REMOTE',
      longText: '第一行\n第二行',
      numberValue: 12.5,
      intValue: 2,
      decimalValue: 3.25,
      moneyValue: 45.67,
      percentValue: 0.125,
      dateValue: '2026-07-31',
      dateTimeValue: '2026-07-31T04:30:00.000Z'
    };
    const contexts: ResolveDataTableEditableCellContext<RoundTripRow>[] = [
      { type: 'text', field: 'text', title: '文本', edit: { allowEmpty: true } },
      {
        type: 'enum',
        field: 'enumValue',
        title: '枚举',
        edit: { selectionMode: 'single', allowEmpty: false },
        valueOptions: [
          { value: 'DRAFT', label: '草稿' },
          { value: 'READY', label: '就绪' }
        ]
      },
      {
        type: 'select',
        field: 'selectedValues',
        title: '多选',
        edit: { selectionMode: 'multiple', allowEmpty: true },
        valueOptions: [
          { value: 1, label: '一' },
          { value: 2, label: '二' }
        ]
      },
      {
        type: 'remoteSelect',
        field: 'remoteValue',
        title: '远程',
        edit: { selectionMode: 'single', allowEmpty: true },
        remoteOptions: {
          loadOptions: async () => ({ items: [] })
        }
      },
      {
        type: 'longText',
        field: 'longText',
        title: '长文本',
        edit: { control: 'textarea', allowEmpty: true }
      },
      {
        type: 'number',
        field: 'numberValue',
        title: '数值',
        edit: { step: 'any' }
      },
      {
        type: 'int',
        field: 'intValue',
        title: '整数',
        edit: { step: 1 }
      },
      {
        type: 'decimal',
        field: 'decimalValue',
        title: '小数',
        edit: { step: 0.01, maxFractionDigits: 2 }
      },
      {
        type: 'money',
        field: 'moneyValue',
        title: '金额',
        edit: { currency: 'USD', step: 0.01, maxFractionDigits: 2 }
      },
      {
        type: 'percent',
        field: 'percentValue',
        title: '百分比',
        edit: { step: 'any', maxFractionDigits: 2 }
      },
      {
        type: 'date',
        field: 'dateValue',
        title: '日期',
        edit: { allowEmpty: false }
      },
      {
        type: 'dateTime',
        field: 'dateTimeValue',
        title: '日期时间',
        tableId: 'round-trip',
        appTimeZone: 'Asia/Shanghai',
        edit: {
          valueKind: 'instant',
          granularity: 'minute',
          step: 1,
          allowEmpty: false
        }
      }
    ];
    const resolved = contexts.map((context) => {
      const cell = resolveDataTableEditableCell(context);
      if (!cell) throw new Error(`Missing adapter for ${context.type}.`);
      return cell;
    });
    const clipboardText = resolved
      .map((cell) => {
        const field = cell.columnMeta.editableCell.field;
        const value = row[field];
        return escapeDataTableCellClipboardText(cell.columnMeta.copyValue?.(value, row) ?? value);
      })
      .join('\t');
    const columns: DataTableMatrixPasteColumn<RoundTripRow>[] = resolved.map((cell) => ({
      columnId: cell.columnMeta.editableCell.field,
      visible: true,
      editableCell: cell.columnMeta.editableCell
    }));

    const plan = await prepareDataTableMatrixPaste({
      clipboardText,
      rows: [{ rowId: row.id, row }],
      columns,
      anchor: { rowIndex: 0, columnIndex: 0 },
      revision: 1,
      isCellEditable: () => true
    });

    expect(plan.status).toBe('ready');
    expect(plan.operations).toHaveLength(0);
    expect(plan.skipped).toHaveLength(contexts.length);
  });
});
