import { formatDateOnly, formatDateTime } from './date';
import { formatFileSize, formatInt, formatMoney, formatPercent } from './number';

export function nullableText(value: unknown) {
  if (value == null || value === '') return '-';
  return String(value);
}

export function nullableTrimmedText(value: unknown) {
  if (typeof value === 'string') return value.trim() || '-';
  return nullableText(value);
}

export function nullableDate(value: string | null | undefined) {
  if (value == null || value === '') return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return formatDateOnly(value) || '-';
}

export function nullableDateTime(value: string | number | Date | null | undefined) {
  return formatDateTime(value ?? undefined) || '-';
}

export function nullableFileSize(value: number | null | undefined) {
  if (typeof value !== 'number') return '-';
  return formatFileSize(value);
}

export function nullableMoney(value: number | null | undefined) {
  return formatMoney(value ?? undefined);
}

export function nullableInt(value: number | null | undefined) {
  return formatInt(value ?? undefined);
}

export function nullablePercent(value: number | null | undefined) {
  return formatPercent(value ?? undefined);
}

export function nullableRawPercent(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return `${value.toLocaleString('zh-CN')}%`;
  return String(value);
}

export function nullableDecimal(value: unknown, maximumFractionDigits = 3) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') {
    return value.toLocaleString('zh-CN', { maximumFractionDigits });
  }
  return String(value);
}

export function nullableYesNo(value: unknown) {
  if (value == null || value === '') return '-';
  if (value === 1 || value === '1' || value === true) return '是';
  if (value === 0 || value === '0' || value === false) return '否';
  return String(value);
}

export function getDictLabel(
  getLabel: (code: string) => string,
  value: string | number | null | undefined
) {
  if (value == null || value === '') return undefined;
  const code = String(value);
  const label = getLabel(code);
  return label === code ? undefined : label;
}
