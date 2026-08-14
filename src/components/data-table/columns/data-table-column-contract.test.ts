import { describe, expect, it } from 'vitest';

import { createDataTableColumnDsl } from './data-table-column-factory';

interface Row {
  name?: string;
}

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

function expectColumnDslTypeErrors() {
  const columnDsl = createDataTableColumnDsl<Row>();
  const choiceColumnDsl = createDataTableColumnDsl<ChoiceRow>();
  const filterObjectApi = { variant: 'text' };
  const disabledSerializeFilter = false;

  // @ts-expect-error filter object API is forbidden
  columnDsl.field('name', '名称', { filter: filterObjectApi });

  // @ts-expect-error serializeFilter only accepts a function
  columnDsl.field('name', '名称', { dsl: { serializeFilter: disabledSerializeFilter } });

  // @ts-expect-error size only accepts a known preset or an exact number
  columnDsl.field('name', '名称', { size: 'huge' });

  choiceColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [{ value: 'ENABLED', label: '启用' }],
    edit: { selectionMode: 'single' }
  });
  choiceColumnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: [{ value: 1, label: '管理员' }],
    edit: { selectionMode: 'multiple', maxSelected: 2 }
  });
  choiceColumnDsl.editableField('name', '手机号', {
    type: 'text',
    edit: { control: 'input', inputType: 'tel' }
  });
  choiceColumnDsl.editableField('status', '状态', {
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

  choiceColumnDsl.editableField('strictRemark', '备注', {
    type: 'longText',
    edit: { control: 'textarea' }
  });
  choiceColumnDsl.editableField('remark', '可空备注', {
    type: 'longText',
    edit: { control: 'textarea', emptyValue: null }
  });

  choiceColumnDsl.editableField('amount', '数量', {
    type: 'int',
    edit: { allowEmpty: false, min: 0, step: 1 }
  });
  choiceColumnDsl.editableField('nullableAmount', '金额', {
    type: 'money',
    edit: { currency: 'CNY' }
  });
  choiceColumnDsl.editableField('nullableAmount', '比例', {
    type: 'percent',
    edit: { maxFractionDigits: 2 }
  });
  choiceColumnDsl.editableField('optionalAmount', '可空数值', {
    type: 'decimal',
    edit: { allowEmpty: true, emptyValue: undefined }
  });
  choiceColumnDsl.editableField('strictDate', '必填日期', {
    type: 'date',
    edit: { allowEmpty: false }
  });
  choiceColumnDsl.editableField('effectiveDate', '生效日期', {
    type: 'date'
  });
  choiceColumnDsl.editableField('executeAt', '执行时间', {
    type: 'dateTime',
    edit: { valueKind: 'instant', timeZone: 'Asia/Shanghai' }
  });
  choiceColumnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: { valueKind: 'local', allowEmpty: false }
  });

  // @ts-expect-error textarea cannot target a number field
  choiceColumnDsl.editableField('amount', '金额备注', {
    type: 'longText',
    edit: { control: 'textarea' }
  });

  // @ts-expect-error emptyValue null requires a nullable string field
  choiceColumnDsl.editableField('strictRemark', '严格备注', {
    type: 'longText',
    edit: { control: 'textarea', emptyValue: null }
  });

  // @ts-expect-error numeric editors cannot target string fields
  choiceColumnDsl.editableField('name', '数量', {
    type: 'number'
  });

  // @ts-expect-error non-nullable number fields must explicitly reject empty input
  choiceColumnDsl.editableField('amount', '数量', {
    type: 'number'
  });

  // @ts-expect-error null empty values require a nullable number field
  choiceColumnDsl.editableField('amount', '数量', {
    type: 'number',
    edit: { allowEmpty: true, emptyValue: null }
  });

  // @ts-expect-error undefined empty values require an optional number field
  choiceColumnDsl.editableField('nullableAmount', '金额', {
    type: 'money',
    edit: { allowEmpty: true, emptyValue: undefined }
  });

  // @ts-expect-error optional number fields must explicitly select undefined or reject empty input
  choiceColumnDsl.editableField('optionalAmount', '可空数值', {
    type: 'decimal',
    edit: { allowEmpty: true }
  });

  // @ts-expect-error date editors cannot target number fields
  choiceColumnDsl.editableField('amount', '日期', {
    type: 'date',
    edit: { allowEmpty: false }
  });

  // @ts-expect-error non-nullable date fields must explicitly reject empty input
  choiceColumnDsl.editableField('strictDate', '必填日期', {
    type: 'date'
  });

  // @ts-expect-error nullable date values are required when allowEmpty is enabled
  choiceColumnDsl.editableField('strictDate', '必填日期', {
    type: 'date',
    edit: { allowEmpty: true, emptyValue: null }
  });

  // @ts-expect-error undefined is not part of the Date Editor domain contract
  choiceColumnDsl.editableField('optionalDate', '可选日期', {
    type: 'date',
    edit: { allowEmpty: false }
  });

  // @ts-expect-error dateTime valueKind is required
  choiceColumnDsl.editableField('executeAt', '执行时间', {
    type: 'dateTime',
    edit: { timeZone: 'Asia/Shanghai' }
  });

  // @ts-expect-error local dateTime cannot configure an instant time zone
  choiceColumnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: { valueKind: 'local', timeZone: 'Asia/Shanghai', allowEmpty: false }
  });

  // @ts-expect-error non-nullable dateTime fields must reject empty input
  choiceColumnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: { valueKind: 'local' }
  });

  // @ts-expect-error dateTime editors cannot target number fields
  choiceColumnDsl.editableField('amount', '执行时间', {
    type: 'dateTime',
    edit: { valueKind: 'instant', timeZone: 'UTC', allowEmpty: false }
  });

  // @ts-expect-error scalar fields cannot use multiple selection
  choiceColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [{ value: 'ENABLED', label: '启用' }],
    edit: { selectionMode: 'multiple' }
  });

  choiceColumnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: [{ value: 1, label: '管理员' }],
    // @ts-expect-error array fields cannot use single selection
    edit: { selectionMode: 'single' }
  });

  // @ts-expect-error non-choice fields cannot use editableField
  choiceColumnDsl.editableField('name', '名称', {
    type: 'select',
    valueOptions: [{ value: 'A', label: 'A' }],
    edit: { selectionMode: 'multiple' }
  });

  // @ts-expect-error maxSelected belongs to multiple selection only
  choiceColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [{ value: 'ENABLED', label: '启用' }],
    edit: { selectionMode: 'single', maxSelected: 2 }
  });
}

describe('data-table-column type contracts', () => {
  it('keeps the compile-time contract fixture loaded', () => {
    expect(expectColumnDslTypeErrors).toBeTypeOf('function');
  });
});
