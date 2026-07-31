import { expectTypeOf } from 'vitest';
import { describe, expect, it } from 'vitest';

import {
  enabledEditableTypeAdapters,
  PLANNED_EDITABLE_TYPES,
  resolveDataTableEditableCell,
  type SupportedEditableType
} from './data-table-edit-adapters';

type Row = {
  id: number;
  name: string;
  remark: string | null;
  status: 'DRAFT' | 'READY' | null;
  roleIds: number[];
  quantity: number;
  amount: number | null;
  ratio?: number;
  effectiveDate: string | null;
  executeAt: string | null;
  localStartsAt: string;
};

describe('data-table-edit-adapters', () => {
  it('derives the public capability gate from enabled adapters', () => {
    expect(Object.keys(enabledEditableTypeAdapters)).toEqual([
      'text',
      'enum',
      'select',
      'remoteSelect',
      'longText',
      'number',
      'int',
      'decimal',
      'money',
      'percent',
      'date',
      'dateTime'
    ]);
    expectTypeOf<SupportedEditableType>().toEqualTypeOf<
      | 'text'
      | 'enum'
      | 'select'
      | 'remoteSelect'
      | 'longText'
      | 'number'
      | 'int'
      | 'decimal'
      | 'money'
      | 'percent'
      | 'date'
      | 'dateTime'
    >();
    expect(PLANNED_EDITABLE_TYPES).toContain('longText');
    expect(PLANNED_EDITABLE_TYPES).toContain('dateTime');
    expect(Object.hasOwn(enabledEditableTypeAdapters, 'percent')).toBe(true);
  });

  it('creates a bound longText codec and explicit-confirm textarea metadata', () => {
    const resolved = resolveDataTableEditableCell<Row>({
      type: 'longText',
      field: 'remark',
      title: '备注',
      edit: {
        control: 'textarea',
        allowEmpty: true,
        emptyValue: null,
        minLength: 2,
        maxLength: 20,
        rows: 4
      }
    });

    expect(resolved?.columnMeta.editableCell).toMatchObject({
      type: 'longText',
      editor: 'textarea',
      commitMode: 'explicit-confirm',
      invalidEditBehavior: 'block',
      allowEmpty: true,
      emptyValue: null,
      minLength: 2,
      maxLength: 20,
      rows: 4
    });
    expect(resolved?.columnMeta.editableCell.codec.parse('', {} as Row)).toEqual({
      status: 'valid',
      value: null
    });
  });

  it('rejects invalid longText option bounds before creating metadata', () => {
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'longText',
        field: 'remark',
        title: '备注',
        edit: {
          control: 'textarea',
          minLength: 5,
          maxLength: 2
        }
      })
    ).toThrow('minLength cannot exceed maxLength');
  });

  it.each([
    ['number', undefined, 'any', undefined],
    ['int', 0, 1, undefined],
    ['decimal', 3, 'any', undefined],
    ['money', 2, 'any', undefined],
    ['percent', 2, 'any', '%']
  ] as const)(
    'creates the shared number editor metadata for %s',
    (type, maxFractionDigits, step, suffix) => {
      const resolved = resolveDataTableEditableCell<Row>({
        type,
        field: 'amount',
        title: '数值',
        edit: { allowEmpty: true }
      });

      expect(resolved?.columnMeta.editableCell).toMatchObject({
        type,
        editor: 'number',
        commitMode: 'blur',
        invalidEditBehavior: 'block',
        allowEmpty: true,
        emptyValue: null,
        step,
        maxFractionDigits,
        allowScientificNotation: false,
        preventStepping: false,
        showStepperButtons: false,
        suffix
      });
    }
  );

  it('derives money currency metadata and preserves an explicitly undefined empty value', () => {
    const money = resolveDataTableEditableCell<Row>({
      type: 'money',
      field: 'amount',
      title: '金额',
      edit: {
        currency: 'CNY',
        currencyDisplay: 'code',
        accounting: true,
        allowEmpty: true,
        maxFractionDigits: 3
      }
    });
    const optionalNumber = resolveDataTableEditableCell<Row>({
      type: 'number',
      field: 'ratio',
      title: '比率',
      edit: {
        allowEmpty: true,
        emptyValue: undefined
      }
    });
    const yen = resolveDataTableEditableCell<Row>({
      type: 'money',
      field: 'amount',
      title: '日元',
      edit: {
        currency: 'JPY'
      }
    });

    expect(money?.columnMeta.editableCell).toMatchObject({
      editor: 'number',
      currency: 'CNY',
      currencyDisplay: 'code',
      accounting: true,
      prefix: 'CNY',
      maxFractionDigits: 3
    });
    expect(optionalNumber?.columnMeta.editableCell).toMatchObject({
      emptyValue: undefined
    });
    expect(optionalNumber?.columnMeta.editableCell.codec.parse('', {} as Row)).toEqual({
      status: 'valid',
      value: undefined
    });
    expect(yen?.columnMeta.editableCell).toMatchObject({
      currency: 'JPY',
      maxFractionDigits: 0
    });
  });

  it('rejects invalid numeric option bounds before creating metadata', () => {
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'decimal',
        field: 'amount',
        title: '数值',
        edit: { min: 2, max: 1 }
      })
    ).toThrow('min cannot exceed max');
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'number',
        field: 'amount',
        title: '数值',
        edit: { step: 0 }
      })
    ).toThrow('step must be a positive finite number');
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'money',
        field: 'amount',
        title: '金额',
        edit: { currency: 'INVALID' }
      })
    ).toThrow('currency "INVALID" is invalid');
  });

  it('creates a bound strict date codec and rejects invalid date bounds', () => {
    const resolved = resolveDataTableEditableCell<Row>({
      type: 'date',
      field: 'effectiveDate',
      title: '生效日期',
      edit: {
        allowEmpty: true,
        min: '2026-01-01',
        max: '2026-12-31',
        isDateUnavailable: (value) => value === '2026-07-31'
      }
    });

    expect(resolved?.columnMeta.editableCell).toMatchObject({
      type: 'date',
      editor: 'date',
      commitMode: 'blur',
      invalidEditBehavior: 'block',
      allowEmpty: true,
      emptyValue: null,
      min: '2026-01-01',
      max: '2026-12-31'
    });
    expect(resolved?.columnMeta.editableCell.codec.validate('2026-07-31', {} as Row)).toEqual([
      '该日期不可选。'
    ]);
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'date',
        field: 'effectiveDate',
        title: '生效日期',
        edit: { min: '2026-02-30' }
      })
    ).toThrow('min must be a valid YYYY-MM-DD');
  });

  it('creates instant and local dateTime metadata with explicit value semantics', () => {
    const instant = resolveDataTableEditableCell<Row>({
      type: 'dateTime',
      field: 'executeAt',
      title: '执行时间',
      tableId: 'orders',
      tableTimeZone: 'Asia/Shanghai',
      appTimeZone: 'UTC',
      edit: {
        valueKind: 'instant',
        granularity: 'minute',
        step: 5,
        defaultTime: '09:30'
      }
    });
    const local = resolveDataTableEditableCell<Row>({
      type: 'dateTime',
      field: 'localStartsAt',
      title: '本地开始时间',
      tableId: 'orders',
      tableTimeZone: 'Mars/Olympus',
      edit: {
        valueKind: 'local',
        granularity: 'second',
        step: 15,
        allowEmpty: false
      }
    });

    expect(instant?.columnMeta.editableCell).toMatchObject({
      type: 'dateTime',
      editor: 'dateTime',
      commitMode: 'explicit-confirm',
      valueKind: 'instant',
      timeZone: 'Asia/Shanghai',
      timeZoneSource: 'table',
      granularity: 'minute',
      step: 5,
      defaultTime: '09:30',
      allowEmpty: true
    });
    expect(instant?.columnMeta.editableCell.codec.parse('2026-07-30 12:05:00', {} as Row)).toEqual({
      status: 'valid',
      value: '2026-07-30T04:05:00.000Z'
    });
    expect(instant?.columnMeta.copyValue?.('2026-07-30T04:05:00.000Z', {} as Row)).toBe(
      '2026-07-30 12:05:00'
    );
    expect(local?.columnMeta.editableCell).toMatchObject({
      valueKind: 'local',
      timeZone: undefined,
      timeZoneSource: undefined,
      granularity: 'second',
      step: 15,
      allowEmpty: false
    });
  });

  it('fails closed during development when instant time zone config is missing or invalid', () => {
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'dateTime',
        field: 'executeAt',
        title: '执行时间',
        tableId: 'orders',
        edit: { valueKind: 'instant' }
      })
    ).toThrow('requires an explicit IANA time zone');
    expect(() =>
      resolveDataTableEditableCell<Row>({
        type: 'dateTime',
        field: 'executeAt',
        title: '执行时间',
        tableId: 'orders',
        appTimeZone: 'Mars/Olympus',
        edit: { valueKind: 'instant' }
      })
    ).toThrow('invalid app time zone "Mars/Olympus"');
  });

  it('creates an independent bound codec for every resolved text column', () => {
    const optional = resolveDataTableEditableCell<Row>({
      type: 'text',
      field: 'name',
      title: '名称',
      edit: { allowEmpty: true }
    });
    const required = resolveDataTableEditableCell<Row>({
      type: 'text',
      field: 'name',
      title: '必填名称',
      edit: { allowEmpty: false }
    });

    expect(optional).not.toBeNull();
    expect(required).not.toBeNull();
    expect(optional?.columnMeta.editableCell?.codec).not.toBe(
      required?.columnMeta.editableCell?.codec
    );
    expect(optional?.columnMeta.editableCell).toMatchObject({
      type: 'text',
      editor: 'input',
      commitMode: 'blur',
      invalidEditBehavior: 'revert'
    });
    expect(optional?.columnMeta.editableCell?.codec.validate('', {} as Row)).toEqual([]);
    expect(required?.columnMeta.editableCell?.codec.validate('', {} as Row)).not.toEqual([]);
  });

  it('resolves choice and switch variants without changing the column type key', () => {
    const choice = resolveDataTableEditableCell<Row>({
      type: 'enum',
      field: 'status',
      title: '状态',
      valueOptions: [
        { value: 'DRAFT', label: '草稿' },
        { value: 'READY', label: '就绪' }
      ],
      edit: { selectionMode: 'single', allowEmpty: false }
    });
    const switchCell = resolveDataTableEditableCell<Row>({
      type: 'enum',
      field: 'status',
      title: '状态',
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

    expect(choice?.columnMeta.editableCell).toMatchObject({
      type: 'enum',
      editor: 'choice',
      selectionMode: 'single',
      commitMode: 'selection'
    });
    expect(choice?.columnMeta.editableChoice).toBe(choice?.columnMeta.editableCell);
    expect(switchCell?.columnMeta.editableCell).toMatchObject({
      type: 'enum',
      editor: 'switch',
      checkedValue: 'READY',
      uncheckedValue: 'DRAFT',
      commitMode: 'selection'
    });
    expect(switchCell?.columnMeta.editableChoice).toBeUndefined();
    expect(switchCell?.columnMeta.editableCell?.codec.validate('READY', {} as Row)).toEqual([]);
    expect(switchCell?.columnMeta.editableCell?.codec.validate(null, {} as Row)).not.toEqual([]);
  });

  it('fails closed when the type adapter or its codec is missing', () => {
    const context = {
      type: 'text' as const,
      field: 'name' as const,
      title: '名称',
      edit: {}
    };

    expect(resolveDataTableEditableCell<Row>(context, {})).toBeNull();
    expect(
      resolveDataTableEditableCell<Row>(context, {
        text: {
          ...enabledEditableTypeAdapters.text,
          createCodec: () => undefined as never
        }
      })
    ).toBeNull();
  });
});
