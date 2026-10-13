import type { DataTableCellSelectionSummary } from './types';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { createDataTableCellRangeIndex } from './data-table-cell-range';
import { formatDataTableSelectionNumber, summarizeDataTableCellRange } from './summary';

function summarize(values: unknown[]) {
  const index = createDataTableCellRangeIndex(
    values.map((_, i) => String(i)),
    ['value']
  );
  return summarizeDataTableCellRange(
    { rowStart: 0, rowEnd: values.length - 1, columnStart: 0, columnEnd: 0 },
    index,
    ({ rowId }) => values[Number(rowId)]
  );
}

function summaryValues(summary: DataTableCellSelectionSummary) {
  return {
    selectedCount: summary.selectedCount,
    numericCount: summary.numericCount,
    sum: summary.sum.toString(),
    average: summary.average.toString(),
    min: summary.min.toString(),
    max: summary.max.toString()
  };
}

describe('选区汇总', () => {
  it('选中包含空值与文本，平均只以数值数量为分母', () => {
    expect(summaryValues(summarize([10, '20', '备注', null]))).toEqual({
      selectedCount: 4,
      numericCount: 2,
      sum: '30',
      average: '15',
      min: '10',
      max: '20'
    });
  });

  it('复用完整数值格式解析，支持正负数、千分位、科学计数和全角输入', () => {
    const result = summarize([' -2.5 ', '+.5', '1,200', '1e2', '１２．５', 0]);
    expect(summaryValues(result)).toMatchObject({
      selectedCount: 6,
      numericCount: 6,
      sum: '1310.5',
      min: '-2.5',
      max: '1200'
    });
    expect(formatDataTableSelectionNumber(result.average, 'average').copyText).toBe('218.417');
  });

  it('不强制转换空值、布尔值、对象、日期和部分匹配的文本', () => {
    const values = [
      null,
      undefined,
      '',
      '  ',
      true,
      false,
      [],
      [1],
      {},
      new Date(),
      '12px',
      '12,34',
      '20%',
      '¥10',
      '0xff',
      'NaN',
      'Infinity',
      NaN,
      Infinity,
      -Infinity,
      '1e999'
    ];
    expect(summarize(values)).toMatchObject({ selectedCount: values.length, numericCount: 0 });
  });

  it('全负数、零、一个有效数值均可汇总', () => {
    expect(summaryValues(summarize([-20, '-10', 0]))).toMatchObject({
      sum: '-30',
      average: '-10',
      min: '-20',
      max: '0'
    });
    expect(summaryValues(summarize(['备注', '0']))).toMatchObject({
      numericCount: 1,
      sum: '0',
      average: '0',
      min: '0',
      max: '0'
    });
  });

  it('只读取指定矩形内的数据，按当前行列顺序定位', () => {
    const index = createDataTableCellRangeIndex(['b', 'a', 'c'], ['y', 'x']);
    const values: Record<string, Record<string, number>> = {
      a: { x: 2, y: 200 },
      b: { x: 1, y: 100 },
      c: { x: 3, y: 300 }
    };
    expect(
      summaryValues(
        summarizeDataTableCellRange(
          { rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 1 },
          index,
          ({ rowId, columnId }) => values[rowId][columnId]
        )
      )
    ).toMatchObject({ selectedCount: 2, sum: '3', average: '1.5' });
  });

  it('十进制求和不产生二进制尾差，也不产生负零', () => {
    expect(summarize([0.1, 0.2]).sum.toString()).toBe('0.3');
    expect(summarize(Array.from({ length: 1000 }, () => '0.01')).sum.toString()).toBe('10');
    expect(formatDataTableSelectionNumber(-0)).toEqual({ text: '0', copyText: '0' });
    expect(formatDataTableSelectionNumber(1250.5)).toEqual({ text: '1,250.5', copyText: '1250.5' });
  });

  it('保留超出安全整数的字符串及最小值、最大值和复制结果', () => {
    const result = summarize(['9007199254740993', '9007199254740995']);
    expect(summaryValues(result)).toMatchObject({
      sum: '18014398509481988',
      average: '9007199254740994',
      min: '9007199254740993',
      max: '9007199254740995'
    });
    expect(formatDataTableSelectionNumber(result.sum).copyText).toBe('18014398509481988');
  });

  it('保留长小数，不经过 number 或十五位有效数字格式化', () => {
    const value = '1.00000000000000000000000000000000000000000000000000000000000001';
    const result = summarize([value, '-1']);
    expect(result.sum.toString()).toBe('1e-62');
    expect(formatDataTableSelectionNumber(result.max).copyText).toBe(value);
    expect(formatDataTableSelectionNumber(result.max).text).toBe(value);
  });

  it('按选区扩展精度，大数相消仍保留小数，合计不受 Number 上限限制', () => {
    expect(summarize([1e16, 1, -1e16]).sum.toString()).toBe('1');
    expect(summarize([1e308, 1, -1e308]).sum.toString()).toBe('1');
    expect(summarize([1e308, 1e-300, -1e308]).sum.toString()).toBe('1e-300');
    const result = summarize([1e308, 1e308]);
    expect(result.average.toString()).toBe('1e+308');
    expect(formatDataTableSelectionNumber(result.sum)).toEqual({
      text: '2E308',
      copyText: '2e+308'
    });
    expect(formatDataTableSelectionNumber(result.sum).text.length).toBeLessThan(30);
  });

  it('保持原有输入范围和下溢为零的规则，拒绝非有限输出', () => {
    expect(summaryValues(summarize(['1e999', '1e-999']))).toMatchObject({
      numericCount: 1,
      sum: '0'
    });
    expect(formatDataTableSelectionNumber(Infinity)).toEqual({
      text: '超出数值范围',
      copyText: null
    });
  });

  it.each([
    ['0.333333333333333333333333', '0.333'],
    ['0.666666666666666666666666', '0.667'],
    ['1.2345', '1.235'],
    ['-1.2345', '-1.235'],
    ['9.9995', '10'],
    ['1.5', '1.5'],
    ['-0.0004', '0'],
    ['1.2344999999999999999999999999999999999999', '1.234']
  ])('平均值 %s 展示与复制均四舍五入到最多三位小数', (value, expected) => {
    expect(formatDataTableSelectionNumber(new Decimal(value), 'average')).toEqual({
      text: expected,
      copyText: expected
    });
  });

  it('平均值只在最终输出时舍入，不改变原始统计或其他统计项', () => {
    const result = summarize([0.12345, 0.12345]);
    expect(result.average.toString()).toBe('0.12345');
    expect(formatDataTableSelectionNumber(result.average, 'average')).toEqual({
      text: '0.123',
      copyText: '0.123'
    });
    expect(formatDataTableSelectionNumber(result.sum)).toEqual({
      text: '0.2469',
      copyText: '0.2469'
    });
  });

  it('循环平均数保留计算精度，只在最终输出舍入', () => {
    const result = summarize(['1', '0', '0']);
    expect(result.average.precision()).toBeGreaterThan(3);
    expect(formatDataTableSelectionNumber(result.average, 'average').copyText).toBe('0.333');
  });

  it('独立的计算配置不受外部 Decimal 设置影响，也不修改外部设置', () => {
    const { precision, rounding } = Decimal;
    try {
      Decimal.set({ precision: 3, rounding: Decimal.ROUND_DOWN });
      expect(summarize(['123456.789', '0.001']).sum.toString()).toBe('123456.79');
      expect(
        formatDataTableSelectionNumber(summarize(['1.2345', '1.2345']).average, 'average').copyText
      ).toBe('1.235');
      expect(Decimal.precision).toBe(3);
      expect(Decimal.rounding).toBe(Decimal.ROUND_DOWN);
    } finally {
      Decimal.set({ precision, rounding });
    }
  });
});
