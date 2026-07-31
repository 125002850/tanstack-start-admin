import { describe, expect, it } from 'vitest';

import {
  createDateEditCodec,
  createDateTimeEditCodec,
  createDataTableIdentityEditCodec,
  createLegacyChoiceEditCodec,
  createLegacySwitchEditCodec,
  createLegacyTextEditCodec,
  createLongTextEditCodec,
  createNumericEditCodec,
  dataTableDateValueToLocalDate,
  localDateToDataTableDateValue
} from './data-table-edit-codecs';

type Row = {
  id: number;
  name: string;
  status: 'DRAFT' | 'READY' | null;
  roleIds: number[];
};

const ROW: Row = {
  id: 1,
  name: '记录',
  status: 'DRAFT',
  roleIds: [1]
};

describe('data-table-edit-codecs', () => {
  it('keeps legacy identity values unchanged through format and parse', () => {
    const codec = createDataTableIdentityEditCodec<Row, number[]>();
    const value = [1, 2];

    expect(codec.formatForEdit(value, ROW)).toBe(value);
    expect(codec.parse(value, ROW)).toEqual({ status: 'valid', value });
    expect(codec.validate(value, ROW)).toEqual([]);
  });

  it('validates legacy text empty values without converting the draft', () => {
    const optionalCodec = createLegacyTextEditCodec<Row>({ allowEmpty: true });
    const requiredCodec = createLegacyTextEditCodec<Row>({ allowEmpty: false });

    expect(optionalCodec.parse('', ROW)).toEqual({ status: 'valid', value: '' });
    expect(optionalCodec.validate('', ROW)).toEqual([]);
    expect(requiredCodec.parse('', ROW)).toEqual({ status: 'valid', value: '' });
    expect(requiredCodec.validate('', ROW)).not.toEqual([]);
  });

  it('keeps numeric-looking legacy text as a string raw candidate', () => {
    const codec = createLegacyTextEditCodec<Row>({ allowEmpty: true });

    const result = codec.parse('123.45', ROW);

    expect(result).toEqual({ status: 'valid', value: '123.45' });
    expect(result.status === 'valid' ? typeof result.value : null).toBe('string');
  });

  it('normalizes long text line endings and applies the configured empty value', () => {
    const stringCodec = createLongTextEditCodec<Row>({
      allowEmpty: true,
      emptyValue: ''
    });
    const nullableCodec = createLongTextEditCodec<Row>({
      allowEmpty: true,
      emptyValue: null
    });

    expect(stringCodec.formatForEdit(null, ROW)).toBe('');
    expect(stringCodec.parse('第一行\r\n第二行\r第三行', ROW)).toEqual({
      status: 'valid',
      value: '第一行\n第二行\n第三行'
    });
    expect(stringCodec.parse('', ROW)).toEqual({ status: 'valid', value: '' });
    expect(nullableCodec.parse('', ROW)).toEqual({ status: 'valid', value: null });
    expect(nullableCodec.parse(42, ROW)).toEqual({
      status: 'invalid',
      errors: ['多行文本草稿必须是字符串。']
    });
  });

  it('validates long text required and character length constraints', () => {
    const codec = createLongTextEditCodec<Row>({
      allowEmpty: false,
      emptyValue: '',
      minLength: 2,
      maxLength: 4
    });

    expect(codec.validate('', ROW)).toEqual(['此项为必填项。']);
    expect(codec.validate('a', ROW)).toEqual(['文本至少需要 2 个字符。']);
    expect(codec.validate('abcd', ROW)).toEqual([]);
    expect(codec.validate('abcde', ROW)).toEqual(['文本最多允许 4 个字符。']);
    expect(codec.validate(null, ROW)).toEqual(['多行文本值必须是字符串。']);
  });

  it('keeps numeric intermediate drafts raw and strictly parses normalized decimal text', () => {
    const codec = createNumericEditCodec<Row>({
      type: 'number',
      allowEmpty: true,
      emptyValue: null,
      step: 'any',
      maxFractionDigits: 2,
      allowScientificNotation: false
    });

    expect(codec.parse('', ROW)).toEqual({ status: 'valid', value: null });
    expect(codec.parse('-', ROW)).toEqual({
      status: 'invalid',
      errors: ['请输入有效的有限数值。']
    });
    expect(codec.parse('１，２３４．５０', ROW)).toEqual({
      status: 'valid',
      value: 1234.5
    });
    expect(codec.parse('12.340', ROW)).toEqual({
      status: 'valid',
      value: 12.34
    });
    expect(codec.parse('12.345', ROW)).toEqual({
      status: 'invalid',
      errors: ['小数位最多允许 2 位。']
    });
    expect(codec.parse('12,34.5', ROW).status).toBe('invalid');
    expect(codec.parse('1,234.5.6', ROW).status).toBe('invalid');
    expect(codec.parse('1e2', ROW)).toEqual({
      status: 'invalid',
      errors: ['不允许使用科学计数法。']
    });
    expect(codec.parse(Number.NaN, ROW).status).toBe('invalid');
  });

  it('gates scientific notation and rejects non-integer int input without truncation', () => {
    const scientific = createNumericEditCodec<Row>({
      type: 'number',
      allowEmpty: false,
      emptyValue: null,
      step: 'any',
      allowScientificNotation: true
    });
    const integer = createNumericEditCodec<Row>({
      type: 'int',
      allowEmpty: false,
      emptyValue: null,
      step: 1,
      maxFractionDigits: 2,
      allowScientificNotation: false
    });

    expect(scientific.parse('1.25e2', ROW)).toEqual({ status: 'valid', value: 125 });
    expect(scientific.parse('1e309', ROW).status).toBe('invalid');
    expect(integer.parse('12.00', ROW)).toEqual({ status: 'valid', value: 12 });
    expect(integer.parse('12.10', ROW)).toEqual({
      status: 'invalid',
      errors: ['请输入整数。']
    });
    expect(integer.validate(12.1, ROW)).toEqual(['请输入整数。']);
  });

  it('validates finite numeric candidates, min/max, and floating point step alignment', () => {
    const codec = createNumericEditCodec<Row>({
      type: 'decimal',
      allowEmpty: false,
      emptyValue: null,
      min: 0,
      max: 1,
      step: 0.1,
      maxFractionDigits: 3,
      allowScientificNotation: false
    });

    expect(codec.validate(Number.NaN, ROW)).toEqual(['数值必须是有限数字。']);
    expect(codec.validate(Number.POSITIVE_INFINITY, ROW)).toEqual(['数值必须是有限数字。']);
    expect(codec.validate(-0.1, ROW)).toEqual(['数值不能小于 0。']);
    expect(codec.validate(1.1, ROW)).toEqual(['数值不能大于 1。']);
    expect(codec.validate(0.1 + 0.2, ROW)).toEqual([]);
    expect(codec.validate(0.35, ROW)).toEqual(['数值必须符合步长 0.1。']);
  });

  it('accepts only the configured money decoration and uses accounting negatives explicitly', () => {
    const codec = createNumericEditCodec<Row>({
      type: 'money',
      allowEmpty: false,
      emptyValue: null,
      step: 'any',
      maxFractionDigits: 2,
      allowScientificNotation: false,
      currency: 'CNY',
      accounting: true
    });

    expect(codec.parse('¥ 1,234.50', ROW)).toEqual({ status: 'valid', value: 1234.5 });
    expect(codec.parse('CNY 1,234.50', ROW)).toEqual({ status: 'valid', value: 1234.5 });
    expect(codec.parse('(¥1,234.50)', ROW)).toEqual({ status: 'valid', value: -1234.5 });
    expect(codec.parse('$1,234.50', ROW)).toEqual({
      status: 'invalid',
      errors: ['输入的货币符号或代码与当前币种不一致。']
    });
  });

  it('round-trips percent drafts as percentage points without hiding excessive precision', () => {
    const codec = createNumericEditCodec<Row>({
      type: 'percent',
      allowEmpty: false,
      emptyValue: null,
      min: 0,
      max: 1,
      step: 'any',
      maxFractionDigits: 2,
      allowScientificNotation: false
    });

    expect(codec.formatForEdit(0.125, ROW)).toBe('12.5');
    expect(codec.parse('12.5%', ROW)).toEqual({ status: 'valid', value: 0.125 });
    expect(codec.parse('１２．３４％', ROW)).toEqual({ status: 'valid', value: 0.1234 });
    expect(codec.parse('12.340', ROW)).toEqual({ status: 'valid', value: 0.1234 });

    const excessivePrecisionDraft = codec.formatForEdit(0.123456, ROW);
    expect(excessivePrecisionDraft).toBe('12.3456');
    expect(codec.parse(excessivePrecisionDraft, ROW).status).toBe('invalid');
    expect(codec.formatForEdit(0.0000123, ROW)).toBe('0.00123');
  });

  it('strictly parses civil dates without accepting nonexistent calendar days', () => {
    const codec = createDateEditCodec<Row>({
      allowEmpty: true
    });

    expect(codec.formatForEdit(null, ROW)).toBe('');
    expect(codec.parse('', ROW)).toEqual({ status: 'valid', value: null });
    expect(codec.parse('2024-02-29', ROW)).toEqual({
      status: 'valid',
      value: '2024-02-29'
    });
    expect(codec.parse('2026-02-29', ROW)).toEqual({
      status: 'invalid',
      errors: ['日期格式必须为 YYYY-MM-DD。']
    });
    expect(codec.parse('2026-02-30', ROW).status).toBe('invalid');
    expect(codec.parse('2026-2-03', ROW).status).toBe('invalid');
    expect(codec.parse(' 2026-02-03 ', ROW).status).toBe('invalid');
    expect(codec.parse('0000-01-01', ROW).status).toBe('invalid');
    expect(codec.parse(new Date(2026, 1, 3), ROW).status).toBe('invalid');
  });

  it('validates date min/max and row-aware unavailable rules for raw and typed values', () => {
    const codec = createDateEditCodec<Row>({
      allowEmpty: false,
      min: '2026-01-01',
      max: '2026-12-31',
      isDateUnavailable: (value, row) => value === '2026-07-31' && row.id === 1
    });

    expect(codec.validate(null, ROW)).toEqual(['此项为必填项。']);
    expect(codec.validate('2025-12-31', ROW)).toEqual(['日期不能早于 2026-01-01。']);
    expect(codec.validate('2027-01-01', ROW)).toEqual(['日期不能晚于 2026-12-31。']);
    expect(codec.validate('2026-07-31', ROW)).toEqual(['该日期不可选。']);
    expect(codec.validate('2026-08-01', ROW)).toEqual([]);
  });

  it('converts Calendar local dates by numeric parts without UTC date-string round-trips', () => {
    const date = dataTableDateValueToLocalDate('0099-12-31');

    expect(date?.getFullYear()).toBe(99);
    expect(date?.getMonth()).toBe(11);
    expect(date?.getDate()).toBe(31);
    expect(localDateToDataTableDateValue(date!)).toBe('0099-12-31');
  });

  it('round-trips local dateTime values without attaching a time zone', () => {
    const codec = createDateTimeEditCodec<Row>({
      valueKind: 'local',
      granularity: 'minute',
      step: 5,
      allowEmpty: true
    });

    expect(codec.formatForEdit(null, ROW)).toBe('');
    expect(codec.formatForEdit('2026-07-30T12:05', ROW)).toBe('2026-07-30 12:05:00');
    expect(codec.parse('', ROW)).toEqual({ status: 'valid', value: null });
    expect(codec.parse('2026-07-30 12:05:00', ROW)).toEqual({
      status: 'valid',
      value: '2026-07-30T12:05'
    });
    expect(codec.parse('2026-07-30 12:05:01', ROW).status).toBe('invalid');
    expect(codec.parse('2026-07-30T12:05', ROW)).toEqual({
      status: 'valid',
      value: '2026-07-30T12:05'
    });
    expect(codec.parse('2026-07-30T12:05:00', ROW).status).toBe('invalid');
    expect(codec.validate('2026-07-30T12:06', ROW)).toEqual(['日期时间必须按 5 分钟递增。']);
    expect(codec.validate('2026-07-30T12:10', ROW)).toEqual([]);
  });

  it('converts instant drafts with a fixed IANA time zone and normalizes offsets to UTC', () => {
    const codec = createDateTimeEditCodec<Row>({
      valueKind: 'instant',
      timeZone: 'Asia/Shanghai',
      granularity: 'minute',
      step: 5,
      allowEmpty: false
    });

    expect(codec.formatForEdit('2026-07-30T04:05:00.000Z', ROW)).toBe('2026-07-30 12:05:00');
    expect(codec.parse('2026-07-30 12:05:00', ROW)).toEqual({
      status: 'valid',
      value: '2026-07-30T04:05:00.000Z'
    });
    expect(codec.parse('2026-07-30T12:05:00+08:00', ROW)).toEqual({
      status: 'valid',
      value: '2026-07-30T04:05:00.000Z'
    });
    expect(codec.parse('2026-07-30T04:05:00Z', ROW)).toEqual({
      status: 'valid',
      value: '2026-07-30T04:05:00.000Z'
    });
  });

  it('rejects instant DST gaps and unresolved overlaps', () => {
    const codec = createDateTimeEditCodec<Row>({
      valueKind: 'instant',
      timeZone: 'America/New_York',
      granularity: 'minute',
      step: 1,
      allowEmpty: false
    });

    expect(codec.parse('2026-03-08 02:30:00', ROW)).toEqual({
      status: 'invalid',
      errors: ['该日期时间在时区 America/New_York 中不存在（夏令时跳变）。']
    });
    expect(codec.parse('2026-11-01 01:30:00', ROW)).toEqual({
      status: 'invalid',
      errors: [
        '该日期时间在时区 America/New_York 中存在歧义（夏令时重叠），请提供明确的 UTC 偏移。'
      ]
    });
    expect(codec.parse('2026-11-01T01:30:00-04:00', ROW)).toEqual({
      status: 'valid',
      value: '2026-11-01T05:30:00.000Z'
    });
    expect(codec.parse('2026-11-01T01:30:00-05:00', ROW)).toEqual({
      status: 'valid',
      value: '2026-11-01T06:30:00.000Z'
    });
  });

  it('validates dateTime granularity, step, and min/max in domain order', () => {
    const local = createDateTimeEditCodec<Row>({
      valueKind: 'local',
      granularity: 'second',
      step: 15,
      allowEmpty: false,
      min: '2026-07-30T12:00:00',
      max: '2026-07-30T13:00:00'
    });
    const instant = createDateTimeEditCodec<Row>({
      valueKind: 'instant',
      timeZone: 'UTC',
      granularity: 'second',
      step: 15,
      allowEmpty: false,
      min: '2026-07-30T12:00:00Z',
      max: '2026-07-30T13:00:00+00:00'
    });

    expect(local.validate('2026-07-30T11:59:45', ROW)).toEqual([
      '日期时间不能早于 2026-07-30T12:00:00。'
    ]);
    expect(local.validate('2026-07-30T12:00:01', ROW)).toEqual(['日期时间必须按 15 秒递增。']);
    expect(local.validate('2026-07-30T12:00:15', ROW)).toEqual([]);
    expect(instant.validate('2026-07-30T13:00:15Z', ROW)).toEqual([
      '日期时间不能晚于 2026-07-30T13:00:00.000Z。'
    ]);
    expect(instant.validate('2026-07-30T12:00:15+00:00', ROW)).toEqual([]);
  });

  it('keeps choice values typed and isolates column-bound validation config', () => {
    const optionalMultipleCodec = createLegacyChoiceEditCodec<Row>({
      selectionMode: 'multiple',
      allowEmpty: true,
      maxSelected: 2
    });
    const requiredMultipleCodec = createLegacyChoiceEditCodec<Row>({
      selectionMode: 'multiple',
      allowEmpty: false,
      maxSelected: 1
    });
    const values = [1, 2];

    expect(optionalMultipleCodec).not.toBe(requiredMultipleCodec);
    expect(optionalMultipleCodec.formatForEdit(values, ROW)).toBe(values);
    expect(optionalMultipleCodec.parse(values, ROW)).toEqual({ status: 'valid', value: values });
    expect(optionalMultipleCodec.validate([], ROW)).toEqual([]);
    expect(optionalMultipleCodec.validate(values, ROW)).toEqual([]);
    expect(requiredMultipleCodec.validate([], ROW)).not.toEqual([]);
    expect(requiredMultipleCodec.validate(values, ROW)).not.toEqual([]);
  });

  it('round-trips static, remote, multiple, and switch choice clipboard drafts', () => {
    const staticNumeric = createLegacyChoiceEditCodec<Row>({
      selectionMode: 'single',
      allowEmpty: true,
      valueOptions: [1, 2]
    });
    const ambiguousStatic = createLegacyChoiceEditCodec<Row>({
      selectionMode: 'single',
      allowEmpty: true,
      valueOptions: [1, '1']
    });
    const remote = createLegacyChoiceEditCodec<Row>({
      selectionMode: 'single',
      allowEmpty: true,
      parseJson: true
    });
    const multiple = createLegacyChoiceEditCodec<Row>({
      selectionMode: 'multiple',
      allowEmpty: true
    });
    const numericSwitch = createLegacySwitchEditCodec<Row>({
      checkedValue: 1,
      uncheckedValue: 0
    });

    expect(staticNumeric.parse('1', ROW)).toEqual({ status: 'valid', value: 1 });
    expect(ambiguousStatic.parse('1', ROW)).toEqual({
      status: 'invalid',
      errors: ['选项值格式无效。']
    });
    expect(remote.parse('"READY"', ROW)).toEqual({ status: 'valid', value: 'READY' });
    expect(remote.parse('1', ROW)).toEqual({ status: 'valid', value: 1 });
    expect(remote.parse('READY', ROW)).toEqual({ status: 'valid', value: 'READY' });
    expect(multiple.parse('[1,"2"]', ROW)).toEqual({
      status: 'valid',
      value: [1, '2']
    });
    expect(multiple.parse('', ROW)).toEqual({ status: 'valid', value: [] });
    expect(numericSwitch.parse('1', ROW)).toEqual({ status: 'valid', value: 1 });
    expect(numericSwitch.parse('0', ROW)).toEqual({ status: 'valid', value: 0 });
  });
});
