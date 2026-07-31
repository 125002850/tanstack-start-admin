import type {
  DataTableChoiceValue,
  DataTableDateValue,
  DataTableDateTimeGranularity,
  DataTableDateTimeValueKind,
  DataTableEditableNumericType,
  DataTableEditCodec
} from '@/types/data-table';
import {
  formatDataTableInstantInTimeZone,
  resolveDataTableZonedDateTime,
  type DataTableDateTimeParts
} from '@/components/ui/table/columns/data-table-time-zone';
import { dataTableMessages } from '@/config/data-table-messages';

const { validation: validationMessages } = dataTableMessages;

type DataTableIdentityEditCodecOptions<TData, TValue> = {
  validate?: (value: TValue, row: TData) => string[];
};

export function createDataTableIdentityEditCodec<TData, TValue>(
  options: DataTableIdentityEditCodecOptions<TData, TValue> = {}
): DataTableEditCodec<TData, TValue> {
  return {
    formatForEdit: (value) => value,
    parse: (draftValue) => ({
      status: 'valid',
      value: draftValue as TValue
    }),
    validate: (value, row) => options.validate?.(value, row) ?? []
  };
}

export function createLegacyTextEditCodec<TData>({
  allowEmpty
}: {
  allowEmpty: boolean;
}): DataTableEditCodec<TData, string | null | undefined> {
  return createDataTableIdentityEditCodec({
    validate: (value) => {
      if (value !== null && value !== undefined && typeof value !== 'string') {
        return [validationMessages.invalidTextValue];
      }
      if (!allowEmpty && (value === null || value === undefined || value === '')) {
        return [validationMessages.required];
      }
      return [];
    }
  });
}

export function createLongTextEditCodec<TData>({
  allowEmpty,
  emptyValue,
  minLength,
  maxLength
}: {
  allowEmpty: boolean;
  emptyValue: '' | null;
  minLength?: number;
  maxLength?: number;
}): DataTableEditCodec<TData, string | null> {
  return {
    formatForEdit: (value) => (value == null ? '' : value),
    parse: (draftValue) => {
      if (typeof draftValue !== 'string') {
        return {
          status: 'invalid',
          errors: [validationMessages.invalidLongTextDraft]
        };
      }

      const normalizedValue = draftValue.replace(/\r\n?/g, '\n');
      return {
        status: 'valid',
        value: normalizedValue === '' ? emptyValue : normalizedValue
      };
    },
    validate: (value) => {
      if (value === null) {
        if (emptyValue !== null) return [validationMessages.invalidLongTextValue];
        return allowEmpty ? [] : [validationMessages.required];
      }
      if (typeof value !== 'string') return [validationMessages.invalidLongTextValue];
      if (!allowEmpty && value.length === 0) return [validationMessages.required];
      if (value.length > 0 && minLength !== undefined && value.length < minLength) {
        return [validationMessages.longTextMinLength(minLength)];
      }
      if (maxLength !== undefined && value.length > maxLength) {
        return [validationMessages.longTextMaxLength(maxLength)];
      }
      return [];
    }
  };
}

type NumericEditCodecOptions = {
  type: DataTableEditableNumericType;
  allowEmpty: boolean;
  emptyValue: null | undefined;
  min?: number;
  max?: number;
  step: number | 'any';
  maxFractionDigits?: number;
  allowScientificNotation: boolean;
  currency?: string;
  accounting?: boolean;
};

function normalizeFullWidthNumericText(value: string) {
  return value
    .replace(/[０-９]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - '０'.charCodeAt(0) + '0'.charCodeAt(0))
    )
    .replaceAll('＋', '+')
    .replaceAll('－', '-')
    .replaceAll('．', '.')
    .replaceAll('，', ',')
    .replaceAll('Ｅ', 'E')
    .replaceAll('ｅ', 'e')
    .replaceAll('％', '%');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCurrencyTokens(currency: string) {
  const tokens = new Set([currency]);
  for (const currencyDisplay of ['symbol', 'narrowSymbol', 'code'] as const) {
    const currencyPart = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      currencyDisplay
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency');
    if (currencyPart?.value) tokens.add(currencyPart.value);
  }
  return [...tokens].toSorted((left, right) => right.length - left.length);
}

function stripCurrencyDecoration(
  value: string,
  currency: string | undefined,
  accounting: boolean
): { status: 'valid'; value: string } | { status: 'invalid' } {
  let normalized = value.trim();
  let isAccountingNegative = false;
  if (normalized.startsWith('(') || normalized.endsWith(')')) {
    if (!accounting || !normalized.startsWith('(') || !normalized.endsWith(')')) {
      return { status: 'invalid' };
    }
    isAccountingNegative = true;
    normalized = normalized.slice(1, -1).trim();
  }

  if (currency) {
    for (const token of getCurrencyTokens(currency)) {
      const pattern = new RegExp(
        `^(?:${escapeRegExp(token)}\\s*)|(?:\\s*${escapeRegExp(token)})$`,
        token === currency ? 'i' : undefined
      );
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '').trim();
        break;
      }
    }
  }

  if (/[\p{Sc}\p{L}]/u.test(normalized.replace(/[eE]/g, ''))) {
    return { status: 'invalid' };
  }
  return {
    status: 'valid',
    value: isAccountingNegative ? `-${normalized}` : normalized
  };
}

function normalizeGroupedNumericText(value: string): string | null {
  if (!value.includes(',')) return value;
  const exponentIndex = value.search(/[eE]/);
  const significand = exponentIndex < 0 ? value : value.slice(0, exponentIndex);
  const exponent = exponentIndex < 0 ? '' : value.slice(exponentIndex);
  if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(significand)) return null;
  return `${significand.replaceAll(',', '')}${exponent}`;
}

function expandExponentialNumber(value: string) {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(value);
  if (!match) return value;
  const [, sign, integerPart = '', fractionPart = '', exponentText = '0'] = match;
  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length + Number(exponentText);
  if (decimalIndex <= 0) {
    return `${sign}0.${'0'.repeat(-decimalIndex)}${digits}`.replace(/\.?0+$/, (zeros) =>
      zeros.startsWith('.') ? '' : zeros
    );
  }
  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function canonicalFiniteNumber(value: number) {
  if (!Number.isFinite(value)) return '';
  const expanded = expandExponentialNumber(String(value));
  if (!expanded.includes('.')) return expanded;
  return expanded.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

function shiftDecimalPoint(value: string, places: number) {
  const sign = value.startsWith('-') ? '-' : '';
  const unsigned = value.replace(/^[+-]/, '');
  const [integerPart = '0', fractionPart = ''] = unsigned.split('.');
  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length + places;
  let shifted: string;
  if (decimalIndex <= 0) {
    shifted = `0.${'0'.repeat(-decimalIndex)}${digits}`;
  } else if (decimalIndex >= digits.length) {
    shifted = `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  } else {
    shifted = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }
  const normalized = shifted.replace(/^0+(?=\d)/, '').replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return `${sign}${normalized}`;
}

function isStepAligned(value: number, min: number | undefined, step: number) {
  const quotient = (value - (min ?? 0)) / step;
  const tolerance = Number.EPSILON * 32 * Math.max(1, Math.abs(quotient));
  return Math.abs(quotient - Math.round(quotient)) <= tolerance;
}

export function createNumericEditCodec<TData>(
  options: NumericEditCodecOptions
): DataTableEditCodec<TData, number | null | undefined> {
  return {
    formatForEdit: (value) => {
      if (value == null) return '';
      if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
      const canonical = canonicalFiniteNumber(value);
      return options.type === 'percent' ? shiftDecimalPoint(canonical, 2) : canonical;
    },
    parse: (draftValue) => {
      if (typeof draftValue !== 'string') {
        return { status: 'invalid', errors: [validationMessages.invalidNumericDraft] };
      }

      let normalized = normalizeFullWidthNumericText(draftValue).trim();
      if (normalized === '') {
        return options.allowEmpty
          ? { status: 'valid', value: options.emptyValue }
          : { status: 'invalid', errors: [validationMessages.required] };
      }

      if (options.type === 'percent' && normalized.endsWith('%')) {
        normalized = normalized.slice(0, -1).trim();
      } else if (normalized.includes('%')) {
        return { status: 'invalid', errors: [validationMessages.invalidNumericDraft] };
      }

      if (options.type === 'money') {
        const stripped = stripCurrencyDecoration(
          normalized,
          options.currency,
          options.accounting ?? false
        );
        if (stripped.status === 'invalid') {
          return { status: 'invalid', errors: [validationMessages.invalidCurrency] };
        }
        normalized = stripped.value;
      }

      const normalizedGrouping = normalizeGroupedNumericText(normalized);
      if (normalizedGrouping === null) {
        return { status: 'invalid', errors: [validationMessages.invalidNumericDraft] };
      }
      normalized = normalizedGrouping;

      const hasScientificNotation = /[eE]/.test(normalized);
      if (hasScientificNotation && !options.allowScientificNotation) {
        return {
          status: 'invalid',
          errors: [validationMessages.scientificNotationNotAllowed]
        };
      }
      const numericPattern = options.allowScientificNotation
        ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
        : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
      if (!numericPattern.test(normalized)) {
        return { status: 'invalid', errors: [validationMessages.invalidNumericDraft] };
      }

      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        return { status: 'invalid', errors: [validationMessages.invalidNumericDraft] };
      }

      const normalizedNumber = canonicalFiniteNumber(parsed);
      const fractionDigits = normalizedNumber.split('.')[1]?.length ?? 0;
      if (options.maxFractionDigits !== undefined && fractionDigits > options.maxFractionDigits) {
        return {
          status: 'invalid',
          errors: [validationMessages.numericMaxFractionDigits(options.maxFractionDigits)]
        };
      }

      const value = options.type === 'percent' ? parsed / 100 : parsed;
      if (options.type === 'int' && !Number.isInteger(value)) {
        return { status: 'invalid', errors: [validationMessages.integerRequired] };
      }
      return { status: 'valid', value };
    },
    validate: (value) => {
      if (value === null || value === undefined) {
        return options.allowEmpty && Object.is(value, options.emptyValue)
          ? []
          : [validationMessages.required];
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return [validationMessages.invalidNumericValue];
      }
      if (options.type === 'int' && !Number.isInteger(value)) {
        return [validationMessages.integerRequired];
      }
      if (options.min !== undefined && value < options.min) {
        return [validationMessages.numericMin(options.min)];
      }
      if (options.max !== undefined && value > options.max) {
        return [validationMessages.numericMax(options.max)];
      }
      if (options.step !== 'any' && !isStepAligned(value, options.min, options.step)) {
        return [validationMessages.numericStep(options.step)];
      }
      return [];
    }
  };
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function getDaysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseDataTableDateValue(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month)) {
    return null;
  }
  return {
    value: value as DataTableDateValue,
    year,
    month,
    day
  };
}

export function dataTableDateValueToLocalDate(value: DataTableDateValue) {
  const parsed = parseDataTableDateValue(value);
  if (!parsed) return undefined;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(parsed.year, parsed.month - 1, parsed.day);
  return date;
}

export function localDateToDataTableDateValue(date: Date): DataTableDateValue {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as DataTableDateValue;
}

export function createDateEditCodec<TData>({
  allowEmpty,
  min,
  max,
  isDateUnavailable
}: {
  allowEmpty: boolean;
  min?: DataTableDateValue;
  max?: DataTableDateValue;
  isDateUnavailable?: (value: DataTableDateValue, row: TData) => boolean;
}): DataTableEditCodec<TData, DataTableDateValue | null> {
  return {
    formatForEdit: (value) => (value == null ? '' : value),
    parse: (draftValue) => {
      if (draftValue === '') {
        return allowEmpty
          ? { status: 'valid', value: null }
          : { status: 'invalid', errors: [validationMessages.required] };
      }
      const parsed = parseDataTableDateValue(draftValue);
      return parsed
        ? { status: 'valid', value: parsed.value }
        : { status: 'invalid', errors: [validationMessages.invalidDateDraft] };
    },
    validate: (value, row) => {
      if (value === null) return allowEmpty ? [] : [validationMessages.required];
      const parsed = parseDataTableDateValue(value);
      if (!parsed) return [validationMessages.invalidDateValue];
      if (min !== undefined && parsed.value < min) {
        return [validationMessages.dateMin(min)];
      }
      if (max !== undefined && parsed.value > max) {
        return [validationMessages.dateMax(max)];
      }
      if (isDateUnavailable?.(parsed.value, row)) {
        return [validationMessages.dateUnavailable];
      }
      return [];
    }
  };
}

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

type DateTimeCodecOptions = {
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

export function createLegacyChoiceEditCodec<TData>({
  selectionMode,
  allowEmpty,
  maxSelected,
  valueOptions,
  parseJson = false
}: {
  selectionMode: 'single' | 'multiple';
  allowEmpty: boolean;
  maxSelected?: number;
  valueOptions?: readonly DataTableChoiceValue[];
  parseJson?: boolean;
}): DataTableEditCodec<TData, DataTableChoiceValue | DataTableChoiceValue[] | null> {
  return {
    formatForEdit: (value) => value,
    parse: (draftValue) => {
      if (draftValue === '') {
        return {
          status: 'valid',
          value: selectionMode === 'multiple' ? [] : null
        };
      }
      if (selectionMode === 'multiple' && typeof draftValue === 'string') {
        try {
          return {
            status: 'valid',
            value: JSON.parse(draftValue) as DataTableChoiceValue[]
          };
        } catch {
          return { status: 'invalid', errors: [validationMessages.invalidChoiceValue] };
        }
      }
      if (selectionMode === 'single' && typeof draftValue === 'string') {
        const matchingOptions = (valueOptions ?? []).filter(
          (value) => String(value) === draftValue
        );
        if (matchingOptions.length === 1) {
          return { status: 'valid', value: matchingOptions[0]! };
        }
        if (matchingOptions.length > 1) {
          return { status: 'invalid', errors: [validationMessages.invalidChoiceValue] };
        }
        if (parseJson) {
          try {
            const parsed = JSON.parse(draftValue) as unknown;
            if (
              parsed === null ||
              typeof parsed === 'string' ||
              (typeof parsed === 'number' && Number.isFinite(parsed))
            ) {
              return { status: 'valid', value: parsed };
            }
          } catch {
            // 非 JSON 文本继续按 legacy string value 处理。
          }
        }
      }
      return {
        status: 'valid',
        value: draftValue as DataTableChoiceValue | DataTableChoiceValue[] | null
      };
    },
    validate: (value) => {
      if (selectionMode === 'multiple') {
        if (
          !Array.isArray(value) ||
          value.some(
            (item) =>
              typeof item !== 'string' && !(typeof item === 'number' && Number.isFinite(item))
          )
        ) {
          return [validationMessages.invalidChoiceValue];
        }
        if (!allowEmpty && value.length === 0) return [validationMessages.required];
        if (maxSelected !== undefined && value.length > maxSelected) {
          return [validationMessages.maxSelectedExceeded];
        }
        return [];
      }

      if (value === null) return allowEmpty ? [] : [validationMessages.required];
      return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
        ? []
        : [validationMessages.invalidChoiceValue];
    }
  };
}

export function createLegacySwitchEditCodec<TData>({
  checkedValue,
  uncheckedValue
}: {
  checkedValue: DataTableChoiceValue;
  uncheckedValue: DataTableChoiceValue;
}): DataTableEditCodec<TData, DataTableChoiceValue | null> {
  return {
    formatForEdit: (value) => value,
    parse: (draftValue) => {
      if (Object.is(draftValue, checkedValue) || Object.is(draftValue, uncheckedValue)) {
        return {
          status: 'valid',
          value: draftValue as DataTableChoiceValue
        };
      }
      if (typeof draftValue === 'string') {
        const matches = [checkedValue, uncheckedValue].filter(
          (value) => String(value) === draftValue
        );
        if (matches.length === 1) {
          return { status: 'valid', value: matches[0]! };
        }
      }
      return {
        status: 'valid',
        value: draftValue as DataTableChoiceValue | null
      };
    },
    validate: (value) =>
      Object.is(value, checkedValue) || Object.is(value, uncheckedValue)
        ? []
        : [validationMessages.invalidSwitchValue]
  };
}
