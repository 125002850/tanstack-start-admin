import { type ClassValue, clsx } from 'clsx';
import { format as formatDateFns } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTime(value: Date | string | number | undefined, fmt: string) {
  if (value == null || value === '') return '-';
  try {
    return formatDateFns(new Date(value), fmt);
  } catch {
    return '-';
  }
}

export function formatDate(value?: string) {
  return formatTime(value, 'yyyy-MM-dd');
}

export function formatMoney(value?: number) {
  if (value == null) return '-';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatInt(value?: number) {
  if (value == null) return '-';
  return value.toLocaleString('zh-CN');
}

export function formatPercent(value?: number) {
  if (value == null) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

export function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {}
) {
  const { decimals = 0, sizeType = 'normal' } = opts;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${
    sizeType === 'accurate' ? (accurateSizes[i] ?? 'Bytest') : (sizes[i] ?? 'Bytes')
  }`;
}
