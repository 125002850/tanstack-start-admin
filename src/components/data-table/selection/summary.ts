import { createNumericEditCodec } from '../editing/codecs/data-table-numeric-edit-codec';
import type {
  DataTableCellCoordinate,
  DataTableCellRangeBounds,
  DataTableCellRangeIndex
} from './data-table-cell-range';
import type { DataTableCellSelectionSummary } from './types';

// 与数值编辑复用完整格式校验；不会把空白、布尔值、日期或 "12px" 转成数字。
const numericCodec = createNumericEditCodec<undefined>({
  type: 'number',
  allowEmpty: false,
  emptyValue: null,
  step: 'any',
  allowScientificNotation: true
});

function toNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = numericCodec.parse(value, undefined);
  return parsed.status === 'valid' && typeof parsed.value === 'number' ? parsed.value : null;
}

export function summarizeDataTableCellRange(
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex,
  getValue: (coordinate: DataTableCellCoordinate) => unknown
): DataTableCellSelectionSummary {
  let selectedCount = 0;
  let numericCount = 0;
  let sum = 0;
  let compensation = 0;
  let average = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let rowIndex = bounds.rowStart; rowIndex <= bounds.rowEnd; rowIndex += 1) {
    const rowId = index.rowIds[rowIndex];
    if (rowId === undefined) continue;
    for (let columnIndex = bounds.columnStart; columnIndex <= bounds.columnEnd; columnIndex += 1) {
      const columnId = index.columnIds[columnIndex];
      if (columnId === undefined) continue;
      selectedCount += 1;
      const value = toNumericValue(getValue({ rowId, columnId }));
      if (value === null) continue;
      numericCount += 1;
      const nextSum = sum + value;
      // 补偿求和，减少大小数混合或正负抵消时的有效位损失。
      if (Number.isFinite(nextSum)) {
        compensation +=
          Math.abs(sum) >= Math.abs(value) ? sum - nextSum + value : value - nextSum + sum;
      } else {
        compensation = 0;
      }
      sum = nextSum;
      // 合计溢出时仍能给出有限的平均值，也避免 value - average 溢出。
      average = average * ((numericCount - 1) / numericCount) + value / numericCount;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  sum += compensation;
  return {
    selectedCount,
    numericCount,
    sum,
    average: Number.isFinite(sum) && numericCount > 0 ? sum / numericCount : average,
    min,
    max
  };
}

const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 21 });
const scientificFormatter = new Intl.NumberFormat('zh-CN', {
  notation: 'scientific',
  maximumSignificantDigits: 21
});

/** 整数保留 number 的有效位；小数显示与复制统一到 15 位有效数字，去除浮点尾差。 */
export function formatDataTableSelectionNumber(value: number): {
  text: string;
  copyText: string | null;
} {
  if (!Number.isFinite(value)) return { text: '超出数值范围', copyText: null };
  const normalized = Number.isInteger(value) ? value : Number(value.toPrecision(15));
  const magnitude = Math.abs(normalized);
  const formatter =
    magnitude >= 1e15 || (magnitude > 0 && magnitude < 1e-6)
      ? scientificFormatter
      : numberFormatter;
  return {
    text: formatter.format(normalized === 0 ? 0 : normalized),
    copyText: String(normalized)
  };
}
