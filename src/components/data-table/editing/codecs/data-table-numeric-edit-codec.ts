import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableEditableNumericType, DataTableEditCodec } from '@/types/data-table';

const { validation: validationMessages } = dataTableMessages;

export type NumericEditCodecOptions = {
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

export function percentPoints(value: number) {
  return value / 100;
}
