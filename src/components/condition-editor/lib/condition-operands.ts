import { findJsonArrayItemValueRanges, parseJsonString } from './condition-json-source';
import {
  CONDITION_OPERATOR_LABELS,
  getConditionField,
  routingOperatorUsesNoValue,
  type ConditionField,
  type ConditionOperator,
  type PredicateCondition
} from '../model/condition-model';

export const CONDITION_INPUT_OPERATORS = [
  'EQ',
  'NE',
  'CONTAINS',
  'NOT_CONTAINS',
  'IN',
  'NOT_IN',
  'NUM_EQ',
  'NUM_NE',
  'NUM_GT',
  'NUM_GE',
  'NUM_LT',
  'NUM_LE',
  'NUM_BETWEEN',
  'NUM_IN',
  'NUM_NOT_IN',
  'GT',
  'GE',
  'LT',
  'LE',
  'BETWEEN',
  'EXISTS',
  'NOT_EXISTS'
] as const satisfies readonly ConditionOperator[];

export const CONDITION_INPUT_OPERATOR_LABELS = {
  ...CONDITION_OPERATOR_LABELS,
  NUM_GT: '大于',
  NUM_GE: '大于等于',
  NUM_LT: '小于',
  NUM_LE: '小于等于',
  NUM_BETWEEN: '介于',
  GT: '晚于',
  GE: '晚于或等于',
  LT: '早于',
  LE: '早于或等于',
  BETWEEN: '日期介于'
} as const satisfies Readonly<Record<ConditionOperator, string>>;

export function isDateConditionInputOperator(operator: ConditionOperator): boolean {
  return ['GT', 'GE', 'LT', 'LE', 'BETWEEN'].includes(operator);
}

export function conditionFieldInput(field: ConditionField | undefined, fallback = ''): string {
  return field?.expression === undefined ? fallback : `{{ ${field.expression} }}`;
}

export function getConditionOperands(
  condition: PredicateCondition,
  catalog: readonly ConditionField[]
) {
  return {
    left:
      condition.leftValue ??
      conditionFieldInput(getConditionField(catalog, condition.field), condition.field),
    right:
      condition.rightValue ??
      (condition.fieldRef !== undefined
        ? conditionFieldInput(getConditionField(catalog, condition.fieldRef), condition.fieldRef)
        : condition.values !== undefined
          ? JSON.stringify(condition.values)
          : (condition.setRef ?? formatConditionLiteral(condition.value)))
  };
}

function formatConditionLiteral(value: string | boolean | undefined): string {
  if (typeof value !== 'string') return String(value ?? '');
  const trimmed = value.trim();
  return trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('"') ||
    value.includes('{{') ||
    value.includes('}}')
    ? JSON.stringify(value)
    : value;
}

export function createInputCondition(
  clientId: string,
  left: string,
  right = '',
  operator: ConditionOperator = 'EQ'
): PredicateCondition {
  return {
    clientId,
    type: 'CONDITION',
    field: '',
    operator,
    leftValue: left,
    ...(routingOperatorUsesNoValue(operator) ? {} : { rightValue: right })
  };
}

export function conditionOperatorUsesCollection(operator: ConditionOperator) {
  return [
    'IN',
    'NOT_IN',
    'BETWEEN',
    'NUM_IN',
    'NUM_NOT_IN',
    'NUM_BETWEEN',
    'DAY_OF_WEEK_IN'
  ].includes(operator);
}

export function parseConditionLiteral(source: string): unknown {
  const text = source.trim();
  return text.startsWith('[') || text.startsWith('"') || text === 'true' || text === 'false'
    ? JSON.parse(text)
    : source;
}

/** 校验数组但始终从原文取值，避免编辑其他项时重写精确数值。 */
export function readConditionCollection(source: string): readonly string[] | undefined {
  if (!source.trim()) return [];
  try {
    const values: unknown = JSON.parse(source);
    if (
      !Array.isArray(values) ||
      values.some((value) => !['string', 'number', 'boolean'].includes(typeof value))
    )
      return;
    return findJsonArrayItemValueRanges(source).map(([from, to]) => source.slice(from, to));
  } catch {
    return;
  }
}

export function conditionCollectionItemInput(source: string): string {
  return parseJsonString(source) ?? source;
}

export function replaceConditionCollectionItem(
  source: string,
  index: number,
  value: string
): string {
  const items = readConditionCollection(source);
  if (!items || index < 0 || index >= items.length) return source;
  let replacement = JSON.stringify(value);
  if (!items[index]!.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (
        ['number', 'boolean'].includes(typeof parsed) &&
        typeof parsed === typeof JSON.parse(items[index]!)
      )
        replacement = value.trim();
    } catch {
      /* 未完成的输入保留为文本草稿。 */
    }
  }
  return `[${items.map((item, itemIndex) => (itemIndex === index ? replacement : item)).join(',')}]`;
}
