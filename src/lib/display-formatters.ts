import { formatDateTime } from '@/lib/format';
import { formatBytes, formatDate, formatInt, formatMoney, formatPercent } from '@/lib/utils';

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
  return formatDate(value);
}

export function nullableDateTime(value: string | number | Date | null | undefined) {
  return formatDateTime(value ?? undefined) || '-';
}

export function nullableFileSize(value: number | null | undefined) {
  if (typeof value !== 'number') return '-';
  return formatBytes(value);
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
