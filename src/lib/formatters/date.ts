const pad = (value: number) => value.toString().padStart(2, '0');
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function resolveDate(value: Date | string | number | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: Date | string | number | undefined) {
  if (typeof value === 'string' && LOCAL_DATE_TIME_PATTERN.test(value)) return value;

  const date = resolveDate(value);
  if (!date) return '';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDateOnly(value: Date | string | number | undefined) {
  const date = resolveDate(value);
  if (!date) return '';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
