export const CONDITION_DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const CONDITION_DEFAULT_TIME_ZONE = 'Asia/Shanghai';

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const LEGACY_OFFSET_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

export function isConditionDateTime(value: string): boolean {
  const localParts = matchLocalDateTime(value);
  if (localParts !== null) return isValidDateTimeParts(localParts);
  return LEGACY_OFFSET_DATE_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function isConditionDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function formatConditionShanghaiDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: CONDITION_DEFAULT_TIME_ZONE,
    year: 'numeric'
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function normalizeConditionDateTime(value: string): string | undefined {
  const localParts = matchLocalDateTime(value);
  if (localParts !== null && isValidDateTimeParts(localParts)) return value;
  if (!LEGACY_OFFSET_DATE_TIME_PATTERN.test(value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : formatConditionShanghaiDateTime(new Date(timestamp));
}

interface DateTimeParts {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly month: number;
  readonly second: number;
  readonly year: number;
}

function matchLocalDateTime(value: string): DateTimeParts | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (match === null) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6])
  };
}

function isValidDateTimeParts(parts: DateTimeParts): boolean {
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return false;
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day &&
    date.getUTCHours() === parts.hour &&
    date.getUTCMinutes() === parts.minute &&
    date.getUTCSeconds() === parts.second
  );
}
