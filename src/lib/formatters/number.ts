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

export function formatFileSize(
  bytes: number,
  options: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {}
) {
  const { decimals = 0, sizeType = 'normal' } = options;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];

  if (bytes === 0) return '0 Byte';

  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const units = sizeType === 'accurate' ? accurateSizes : sizes;
  return `${(bytes / 1024 ** index).toFixed(decimals)} ${units[index] ?? 'Bytes'}`;
}
