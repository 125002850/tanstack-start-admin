import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableChoiceValue, DataTableEditCodec } from '@/types/data-table';

const { validation: validationMessages } = dataTableMessages;

export function createChoiceEditCodec<TData>({
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

export function createSwitchEditCodec<TData>({
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
