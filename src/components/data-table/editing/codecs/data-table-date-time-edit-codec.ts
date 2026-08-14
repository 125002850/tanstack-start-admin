import {
  formatDataTableInstantInTimeZone,
  resolveDataTableZonedDateTime,
  type DataTableDateTimeParts
} from '@/components/data-table/editing/data-table-time-zone';
import { parseDataTableDateValue } from '@/components/data-table/editing/codecs/data-table-date-edit-codec';
import { dataTableMessages } from '@/config/data-table-messages';
import type {
  DataTableDateTimeGranularity,
  DataTableDateTimeValueKind,
  DataTableEditCodec
} from '@/types/data-table';

const { validation: validationMessages } = dataTableMessages;

export type ParsedDataTableLocalDateTime = {
  value: string;
  parts: DataTableDateTimeParts;
  scalarMilliseconds: number;
};

function createLocalDateTimeScalar(parts: DataTableDateTimeParts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.getTime();
}

function padDateTimePart(value: number, length = 2) {
  return String(value).padStart(length, '0');
}

export function formatDataTableLocalDateTimeValue(
  parts: DataTableDateTimeParts,
  granularity: DataTableDateTimeGranularity
) {
  const date = `${padDateTimePart(parts.year, 4)}-${padDateTimePart(parts.month)}-${padDateTimePart(parts.day)}`;
  const time = `${padDateTimePart(parts.hour)}:${padDateTimePart(parts.minute)}`;
  return granularity === 'second'
    ? `${date}T${time}:${padDateTimePart(parts.second)}`
    : `${date}T${time}`;
}

export function formatDataTableDateTimeDraftValue(parts: DataTableDateTimeParts) {
  return formatDataTableLocalDateTimeValue(parts, 'second').replace('T', ' ');
}

export function parseDataTableLocalDateTimeValue(
  value: unknown,
  granularity: DataTableDateTimeGranularity
): ParsedDataTableLocalDateTime | null {
  if (typeof value !== 'string') return null;
  const pattern =
    granularity === 'second'
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
      : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  const match = pattern.exec(value);
  if (!match) return null;
  const date = parseDataTableDateValue(`${match[1]}-${match[2]}-${match[3]}`);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = granularity === 'second' ? Number(match[6]) : 0;
  if (!date || hour > 23 || minute > 59 || second > 59) return null;
  const parts = {
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
    second
  };
  return {
    value,
    parts,
    scalarMilliseconds: createLocalDateTimeScalar(parts)
  };
}

export function parseDataTableDateTimeDraftValue(
  value: unknown,
  granularity: DataTableDateTimeGranularity
): ParsedDataTableLocalDateTime | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const parsed = parseDataTableLocalDateTimeValue(`${match[1]}T${match[2]}:${match[3]}`, 'second');
  if (!parsed || (granularity === 'minute' && parsed.parts.second !== 0)) return null;
  return {
    ...parsed,
    value: formatDataTableLocalDateTimeValue(parsed.parts, granularity)
  };
}

type ParsedDataTableInstant = {
  value: string;
  epochMilliseconds: number;
};

function parseDataTableInstantValue(
  value: unknown,
  granularity: DataTableDateTimeGranularity
): ParsedDataTableInstant | null {
  if (typeof value !== 'string') return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value
    );
  if (!match) return null;
  const date = parseDataTableDateValue(`${match[1]}-${match[2]}-${match[3]}`);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const hasSecond = match[6] !== undefined;
  const second = Number(match[6] ?? 0);
  const milliseconds = Number(match[7] ?? 0);
  if (
    !date ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (granularity === 'second' && !hasSecond) ||
    (granularity === 'minute' && (second !== 0 || milliseconds !== 0)) ||
    (granularity === 'second' && milliseconds !== 0)
  ) {
    return null;
  }
  const offset = match[8]!;
  let offsetMinutes = 0;
  if (offset !== 'Z') {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    const direction = offset[0] === '-' ? -1 : 1;
    offsetMinutes = direction * (offsetHour * 60 + offsetMinute);
  }
  const wallClockMilliseconds = createLocalDateTimeScalar({
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
    second
  });
  const epochMilliseconds = wallClockMilliseconds - offsetMinutes * 60 * 1000;
  const normalizedDate = new Date(epochMilliseconds);
  const normalizedYear = normalizedDate.getUTCFullYear();
  if (normalizedYear < 1 || normalizedYear > 9999) return null;
  const normalized = normalizedDate.toISOString();
  return { value: normalized, epochMilliseconds };
}

export type DateTimeCodecOptions = {
  valueKind: DataTableDateTimeValueKind;
  timeZone?: string;
  granularity: DataTableDateTimeGranularity;
  step: number;
  allowEmpty: boolean;
  min?: string;
  max?: string;
};

type ParsedDateTimeDomainValue = {
  value: string;
  scalarMilliseconds: number;
};

function parseDateTimeDomainValue(
  value: unknown,
  options: DateTimeCodecOptions
): ParsedDateTimeDomainValue | null {
  if (options.valueKind === 'local') {
    const parsed = parseDataTableLocalDateTimeValue(value, options.granularity);
    return parsed ? { value: parsed.value, scalarMilliseconds: parsed.scalarMilliseconds } : null;
  }
  const parsed = parseDataTableInstantValue(value, options.granularity);
  return parsed ? { value: parsed.value, scalarMilliseconds: parsed.epochMilliseconds } : null;
}

function getDateTimeStepError(options: DateTimeCodecOptions) {
  return validationMessages.dateTimeStep(options.step, options.granularity);
}

export function createDateTimeEditCodec<TData>(
  options: DateTimeCodecOptions
): DataTableEditCodec<TData, string | null> {
  if (options.valueKind === 'instant' && !options.timeZone) {
    throw new Error('DataTable instant DateTime codec requires an explicit time zone.');
  }
  const min = options.min ? parseDateTimeDomainValue(options.min, options) : undefined;
  const max = options.max ? parseDateTimeDomainValue(options.max, options) : undefined;
  if (options.min !== undefined && !min) {
    throw new Error('DataTable editable dateTime min does not match valueKind and granularity.');
  }
  if (options.max !== undefined && !max) {
    throw new Error('DataTable editable dateTime max does not match valueKind and granularity.');
  }
  if (min && max && min.scalarMilliseconds > max.scalarMilliseconds) {
    throw new Error('DataTable editable dateTime min cannot exceed max.');
  }
  const resolvedOptions = {
    ...options,
    min: min?.value,
    max: max?.value
  };

  return {
    formatForEdit: (value) => {
      if (value === null) return '';
      if (options.valueKind === 'local') {
        const parsed = parseDataTableLocalDateTimeValue(value, options.granularity);
        return parsed ? formatDataTableDateTimeDraftValue(parsed.parts) : value;
      }
      const parsed = parseDataTableInstantValue(value, options.granularity);
      if (!parsed) return value;
      return formatDataTableDateTimeDraftValue(
        formatDataTableInstantInTimeZone(parsed.epochMilliseconds, options.timeZone!)
      );
    },
    parse: (draftValue) => {
      if (draftValue === '') {
        return options.allowEmpty
          ? { status: 'valid', value: null }
          : { status: 'invalid', errors: [validationMessages.required] };
      }
      if (options.valueKind === 'local') {
        const parsed =
          parseDataTableDateTimeDraftValue(draftValue, options.granularity) ??
          parseDataTableLocalDateTimeValue(draftValue, options.granularity);
        return parsed
          ? { status: 'valid', value: parsed.value }
          : { status: 'invalid', errors: [validationMessages.invalidDateTimeDraft] };
      }
      const explicitInstant = parseDataTableInstantValue(draftValue, options.granularity);
      if (explicitInstant) return { status: 'valid', value: explicitInstant.value };
      const local =
        parseDataTableDateTimeDraftValue(draftValue, options.granularity) ??
        parseDataTableLocalDateTimeValue(draftValue, options.granularity);
      if (!local) {
        return { status: 'invalid', errors: [validationMessages.invalidDateTimeDraft] };
      }
      const resolution = resolveDataTableZonedDateTime(local.parts, options.timeZone!);
      if (resolution.status === 'gap') {
        return {
          status: 'invalid',
          errors: [validationMessages.dateTimeGap(options.timeZone!)]
        };
      }
      if (resolution.status === 'overlap') {
        return {
          status: 'invalid',
          errors: [validationMessages.dateTimeOverlap(options.timeZone!)]
        };
      }
      return {
        status: 'valid',
        value: new Date(resolution.epochMilliseconds).toISOString()
      };
    },
    validate: (value) => {
      if (value === null) return options.allowEmpty ? [] : [validationMessages.required];
      const parsed = parseDateTimeDomainValue(value, resolvedOptions);
      if (!parsed) return [validationMessages.invalidDateTimeValue];
      if (min && parsed.scalarMilliseconds < min.scalarMilliseconds) {
        return [validationMessages.dateTimeMin(min.value)];
      }
      if (max && parsed.scalarMilliseconds > max.scalarMilliseconds) {
        return [validationMessages.dateTimeMax(max.value)];
      }
      const stepMilliseconds = options.step * (options.granularity === 'minute' ? 60 * 1000 : 1000);
      const stepBase = min?.scalarMilliseconds ?? 0;
      if ((parsed.scalarMilliseconds - stepBase) % stepMilliseconds !== 0) {
        return [getDateTimeStepError(options)];
      }
      return [];
    }
  };
}
