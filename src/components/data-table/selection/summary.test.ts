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

describe('选区汇总', () => {
  it('选中包含空值与文本，平均只以数值数量为分母', () => {
    expect(summarize([10, '20', '备注', null])).toEqual({
      selectedCount: 4,
      numericCount: 2,
      sum: 30,
      average: 15,
      min: 10,
      max: 20
    });
  });

  it('复用完整数值格式解析，支持正负数、千分位、科学计数和全角输入', () => {
    expect(summarize([' -2.5 ', '+.5', '1,200', '1e2', '１２．５', 0])).toEqual({
      selectedCount: 6,
      numericCount: 6,
      sum: 1310.5,
      average: 1310.5 / 6,
      min: -2.5,
      max: 1200
    });
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
    expect(summarize([-20, '-10', 0])).toMatchObject({ sum: -30, average: -10, min: -20, max: 0 });
    expect(summarize(['备注', '0'])).toMatchObject({
      numericCount: 1,
      sum: 0,
      average: 0,
      min: 0,
      max: 0
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
      summarizeDataTableCellRange(
        { rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 1 },
        index,
        ({ rowId, columnId }) => values[rowId][columnId]
      )
    ).toMatchObject({ selectedCount: 2, sum: 3, average: 1.5 });
  });

  it('补偿求和保留抵消后的有效值，格式化避免浮点尾差与负零', () => {
    expect(summarize([1e16, 1, -1e16]).sum).toBe(1);
    expect(formatDataTableSelectionNumber(summarize([0.1, 0.2]).sum)).toEqual({
      text: '0.3',
      copyText: '0.3'
    });
    expect(formatDataTableSelectionNumber(-0)).toEqual({ text: '0', copyText: '0' });
    expect(formatDataTableSelectionNumber(1250.5)).toEqual({ text: '1,250.5', copyText: '1250.5' });
  });

  it('极端数值不会显示无限长文本或把溢出值复制为正常结果', () => {
    const result = summarize([1e308, 1e308]);
    expect(result.average).toBe(1e308);
    expect(formatDataTableSelectionNumber(result.sum)).toEqual({
      text: '超出数值范围',
      copyText: null
    });
    expect(formatDataTableSelectionNumber(1e308).text.length).toBeLessThan(30);
    expect(formatDataTableSelectionNumber(1e-20).copyText).toBe('1e-20');
    expect(formatDataTableSelectionNumber(Number.MAX_SAFE_INTEGER).copyText).toBe(
      '9007199254740991'
    );
  });
});
