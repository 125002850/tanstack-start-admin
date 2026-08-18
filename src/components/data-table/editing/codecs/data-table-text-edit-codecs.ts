import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableEditCodec } from '../types';

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

export function createTextEditCodec<TData>({
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
