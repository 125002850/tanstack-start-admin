import { describe, expect, it, vi } from 'vitest';

import {
  createDataTableColumnDsl,
  percentPoints
} from '@/components/data-table/columns/data-table-column-factory';

interface ChoiceRow {
  id: number;
  status: 'ENABLED' | 'DISABLED' | null;
  roleIds: number[];
  name: string;
  strictRemark: string;
  remark: string | null;
  amount: number;
  nullableAmount: number | null;
  optionalAmount?: number;
  strictDate: string;
  effectiveDate: string | null;
  optionalDate?: string;
  executeAt: string | null;
  localStartsAt: string;
}

describe('data-table-editable-column-builder', () => {
  it('creates editable choice columns with static filter defaults and remote metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const statusColumn = columnDsl.editableField('status', '状态', {
      type: 'enum',
      valueOptions: [
        { value: 'ENABLED', label: '启用' },
        { value: 'DISABLED', label: '停用' }
      ],
      edit: { selectionMode: 'single', allowEmpty: false },
      filter: 'select'
    });
    const loadOptions = vi.fn();
    const roleColumn = columnDsl.editableField('roleIds', '角色', {
      type: 'remoteSelect',
      remoteOptions: {
        loadOptions
      },
      edit: { selectionMode: 'multiple', maxSelected: 3 }
    });

    expect((statusColumn as { accessorKey?: unknown }).accessorKey).toBe('status');
    expect(statusColumn.meta?.options).toEqual([
      { value: 'ENABLED', label: '启用' },
      { value: 'DISABLED', label: '停用' }
    ]);
    expect(statusColumn.meta?.localFilter).toMatchObject({
      variant: 'select',
      options: [
        { value: 'ENABLED', label: '启用' },
        { value: 'DISABLED', label: '停用' }
      ]
    });
    expect(statusColumn.meta?.editableChoice).toMatchObject({
      field: 'status',
      type: 'enum',
      selectionMode: 'single',
      allowEmpty: false
    });
    expect(statusColumn.meta?.editableCell).toBe(statusColumn.meta?.editableChoice);
    expect(roleColumn.meta?.editableChoice).toMatchObject({
      field: 'roleIds',
      type: 'remoteSelect',
      selectionMode: 'multiple',
      allowEmpty: true,
      maxSelected: 3
    });
    expect(roleColumn.meta?.editableChoice?.remoteOptions?.loadOptions).toBe(loadOptions);
    expect(roleColumn.meta?.localFilter).toMatchObject({ variant: 'text' });
  });

  it('creates input and switch editors as first-class editable cells', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const defaultInputColumn = columnDsl.editableField('name', '名称', {
      type: 'text'
    });
    const inputColumn = columnDsl.editableField('name', '手机号', {
      type: 'text',
      edit: { control: 'input', inputType: 'tel', inputMode: 'tel' }
    });
    const switchColumn = columnDsl.editableField('status', '状态', {
      type: 'enum',
      valueOptions: [
        { value: 'ENABLED', label: '启用' },
        { value: 'DISABLED', label: '停用' }
      ],
      edit: {
        control: 'switch',
        checkedValue: 'ENABLED',
        uncheckedValue: 'DISABLED'
      }
    });

    expect(defaultInputColumn.meta?.editableCell).toMatchObject({
      field: 'name',
      editor: 'input',
      allowEmpty: true,
      inputType: 'text'
    });
    expect(inputColumn.meta?.editableCell).toMatchObject({
      field: 'name',
      editor: 'input',
      allowEmpty: true,
      inputType: 'tel',
      inputMode: 'tel'
    });
    expect(inputColumn.meta?.editableChoice).toBeUndefined();
    expect(switchColumn.meta?.editableCell).toMatchObject({
      field: 'status',
      editor: 'switch',
      allowEmpty: false,
      checkedValue: 'ENABLED',
      uncheckedValue: 'DISABLED',
      checkedLabel: '启用',
      uncheckedLabel: '停用'
    });
    expect(switchColumn.meta?.editableChoice).toBeUndefined();
  });

  it('rejects invalid editable multiple selection limits at runtime', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();

    expect(() =>
      columnDsl.editableField('roleIds', '角色', {
        type: 'select',
        valueOptions: [{ value: 1, label: '管理员' }],
        edit: { selectionMode: 'multiple', maxSelected: 0 }
      })
    ).toThrow('maxSelected must be a positive integer');
  });

  it('creates typed numeric columns with machine-readable copy metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const numberColumn = columnDsl.editableField('amount', '数量', {
      type: 'number',
      edit: { allowEmpty: false, min: 0, step: 0.1 }
    });
    const moneyColumn = columnDsl.editableField('nullableAmount', '金额', {
      type: 'money',
      edit: { currency: 'CNY' }
    });
    const percentColumn = columnDsl.editableField('nullableAmount', '比例', {
      type: 'percent',
      edit: { min: percentPoints(5), max: percentPoints(100) }
    });

    expect(numberColumn.meta?.editableCell).toMatchObject({
      type: 'number',
      editor: 'number',
      allowEmpty: false,
      min: 0,
      step: 0.1
    });
    expect(moneyColumn.meta?.editableCell).toMatchObject({
      type: 'money',
      editor: 'number',
      currency: 'CNY'
    });
    expect(percentColumn.meta?.editableCell).toMatchObject({
      type: 'percent',
      min: 0.05,
      max: 1
    });
    expect(percentColumn.meta?.copyValue?.(0.125, {} as ChoiceRow)).toBe('12.5');
  });

  it('creates typed date columns with strict nullable metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const required = columnDsl.editableField('strictDate', '必填日期', {
      type: 'date',
      edit: {
        allowEmpty: false,
        min: '2026-01-01',
        max: '2026-12-31'
      }
    });
    const optional = columnDsl.editableField('effectiveDate', '生效日期', {
      type: 'date'
    });

    expect(required.meta?.editableCell).toMatchObject({
      type: 'date',
      editor: 'date',
      allowEmpty: false,
      min: '2026-01-01',
      max: '2026-12-31'
    });
    expect(optional.meta?.editableCell).toMatchObject({
      type: 'date',
      editor: 'date',
      allowEmpty: true,
      emptyValue: null
    });
  });

  it('creates typed dateTime columns with bound time zone metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>({
      tableId: 'orders',
      tableTimeZone: 'Asia/Shanghai',
      appTimeZone: 'UTC'
    });
    const instant = columnDsl.editableField('executeAt', '执行时间', {
      type: 'dateTime',
      edit: {
        valueKind: 'instant',
        granularity: 'minute',
        step: 5
      }
    });
    const local = columnDsl.editableField('localStartsAt', '本地开始时间', {
      type: 'dateTime',
      edit: {
        valueKind: 'local',
        granularity: 'second',
        allowEmpty: false
      }
    });

    expect(instant.meta?.editableCell).toMatchObject({
      type: 'dateTime',
      editor: 'dateTime',
      valueKind: 'instant',
      timeZone: 'Asia/Shanghai',
      timeZoneSource: 'table',
      commitMode: 'explicit-confirm'
    });
    expect(local.meta?.editableCell).toMatchObject({
      type: 'dateTime',
      editor: 'dateTime',
      valueKind: 'local',
      timeZone: undefined
    });
  });

  it('fails closed to a read-only column when a disabled adapter bypasses the type gate', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const unsafeEditableField = columnDsl.editableField as unknown as (
      key: 'amount',
      title: string,
      options: { type: 'unsupported' }
    ) => ReturnType<typeof columnDsl.field>;

    const column = unsafeEditableField('amount', '未知类型', { type: 'unsupported' });

    expect(column.meta?.editableCell).toBeUndefined();
    expect(column.meta?.editableChoice).toBeUndefined();
  });
});
