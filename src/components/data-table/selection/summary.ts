import Decimal from 'decimal.js';
import type {
  DataTableCellCoordinate,
  DataTableCellRangeBounds,
  DataTableCellRangeIndex
} from './data-table-cell-range';
import {
  isDecimalNumericText,
  normalizeFullWidthNumericText,
  normalizeGroupedNumericText
} from '@/lib/data-table/numeric-text';

import type { DataTableCellSelectionSummary } from './types';

const MIN_CALCULATION_PRECISION = 40;
const AVERAGE_DECIMAL_PLACES = 3;
const SCIENTIFIC_UPPER_EXPONENT = 15;
const SCIENTIFIC_LOWER_EXPONENT = -6;
// 使用独立构造器，避免更改其他模块的精度、舍入与字符串输出配置。
const SelectionDecimal = Decimal.clone({
  precision: MIN_CALCULATION_PRECISION,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21
});

function toNumericValue(value: unknown): Decimal | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? new SelectionDecimal(value) : null;
  }
  if (typeof value !== 'string') return null;
  const normalized = normalizeGroupedNumericText(normalizeFullWidthNumericText(value).trim());
  if (normalized === null || !isDecimalNumericText(normalized, true)) return null;
  // Number 仅用于维持原有输入范围（含下溢为零），非零字符串按原文构造 Decimal。
  // 不接受 Infinity、超出原有有限数值范围的指数或非十进制文本。
  const rangeCheck = Number(normalized);
  if (!Number.isFinite(rangeCheck)) return null;
  return new SelectionDecimal(rangeCheck === 0 ? 0 : normalized);
}

export function summarizeDataTableCellRange(
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex,
  getValue: (coordinate: DataTableCellCoordinate) => unknown
): DataTableCellSelectionSummary {
  // 每次汇总独立扩展精度，极端选区不会改变后续选区或其他模块的配置。
  const CalculationDecimal = SelectionDecimal.clone();
  let selectedCount = 0;
  let numericCount = 0;
  let sum = new CalculationDecimal(0);
  let min = new SelectionDecimal(Infinity);
  let max = new SelectionDecimal(-Infinity);

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
      // 覆盖两数的完整整数、小数和进位，避免大数相消时先丢失较小的加数。
      const precision =
        Math.max(1, sum.e + 1, value.e + 1) +
        Math.max(sum.decimalPlaces(), value.decimalPlaces()) +
        1;
      if (precision > CalculationDecimal.precision) CalculationDecimal.set({ precision });
      sum = sum.plus(value);
      if (value.lt(min)) min = value;
      if (value.gt(max)) max = value;
    }
  }

  // 除法保留额外有效位；平均值只在最终展示和复制时舍入到三位小数。
  CalculationDecimal.set({
    precision: Math.max(
      CalculationDecimal.precision,
      sum.precision(true) + String(numericCount).length + AVERAGE_DECIMAL_PLACES + 1
    )
  });
  return {
    selectedCount,
    numericCount,
    sum,
    average: numericCount > 0 ? sum.div(numericCount) : new CalculationDecimal(0),
    min,
    max
  };
}

/** 直接从 Decimal 输出字符串，展示和复制均不转回 number。 */
export function formatDataTableSelectionNumber(
  value: Decimal | number,
  format: 'number' | 'average' = 'number'
): {
  text: string;
  copyText: string | null;
} {
  let normalized = new SelectionDecimal(value);
  if (!normalized.isFinite()) return { text: '超出数值范围', copyText: null };
  if (format === 'average') {
    normalized = normalized.toDecimalPlaces(AVERAGE_DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
  }
  if (normalized.isZero()) return { text: '0', copyText: '0' };
  const copyText = normalized.toString();
  if (normalized.e >= SCIENTIFIC_UPPER_EXPONENT || normalized.e < SCIENTIFIC_LOWER_EXPONENT) {
    return { text: normalized.toExponential().replace('e+', 'E').replace('e-', 'E-'), copyText };
  }
  const [integer, fraction] = normalized.toFixed().split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return {
    text: fraction === undefined ? groupedInteger : `${groupedInteger}.${fraction}`,
    copyText
  };
}
