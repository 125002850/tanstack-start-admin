import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableDateValue, DataTableEditCodec } from '../types';

const { validation: validationMessages } = dataTableMessages;

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
