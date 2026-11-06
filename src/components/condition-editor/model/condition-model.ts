export type ConditionFieldType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'DAY_OF_WEEK'
  | 'TIME';
export type ConditionOperator =
  | 'EQ'
  | 'NE'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'GT'
  | 'GE'
  | 'LT'
  | 'LE'
  | 'BETWEEN'
  | 'IN'
  | 'NOT_IN'
  | 'NUM_EQ'
  | 'NUM_NE'
  | 'NUM_GT'
  | 'NUM_GE'
  | 'NUM_LT'
  | 'NUM_LE'
  | 'NUM_BETWEEN'
  | 'NUM_IN'
  | 'NUM_NOT_IN'
  | 'DAY_OF_WEEK_IN'
  | 'IS_WORKDAY'
  | 'IS_NON_WORKDAY'
  | 'EXISTS'
  | 'NOT_EXISTS';

export const CONDITION_OPERATOR_LABELS: Readonly<Record<ConditionOperator, string>> = {
  EQ: '等于',
  NE: '不等于',
  CONTAINS: '包含',
  NOT_CONTAINS: '不包含',
  GT: '大于',
  GE: '大于等于',
  LT: '小于',
  LE: '小于等于',
  BETWEEN: '介于',
  IN: '属于',
  NOT_IN: '不属于',
  NUM_EQ: '数字等于',
  NUM_NE: '数字不等于',
  NUM_GT: '数字大于',
  NUM_GE: '数字大于等于',
  NUM_LT: '数字小于',
  NUM_LE: '数字小于等于',
  NUM_BETWEEN: '数字介于',
  NUM_IN: '数字属于',
  NUM_NOT_IN: '数字不属于',
  DAY_OF_WEEK_IN: '星期为',
  IS_WORKDAY: '是工作日',
  IS_NON_WORKDAY: '是非工作日',
  EXISTS: '存在',
  NOT_EXISTS: '不存在'
};

export interface AlwaysCondition {
  readonly clientId: string;
  readonly type: 'ALWAYS';
}

export interface GroupCondition {
  readonly clientId: string;
  readonly type: 'GROUP';
  readonly logic: 'AND' | 'OR';
  readonly children: readonly ConditionNode[];
}

export interface PredicateCondition {
  readonly clientId: string;
  readonly type: 'CONDITION';
  readonly field: string;
  /** 输入框模式保存原文；field 仅用于兼容已有目录条件。 */
  readonly leftValue?: string;
  readonly rightValue?: string;
  readonly operator: ConditionOperator;
  readonly value?: string | boolean;
  readonly values?: readonly (string | boolean)[];
  readonly fieldRef?: string;
  readonly setRef?: string;
}

export type ConditionNode = AlwaysCondition | GroupCondition | PredicateCondition;

export interface ConditionField {
  readonly expression?: string;
  readonly description?: string;
  readonly label: string;
  readonly path: string;
  readonly selectable?: boolean;
  readonly type: ConditionFieldType;
  readonly source: 'PAYLOAD' | 'CONTEXT' | 'SYSTEM' | 'LEGACY';
}

export interface ConditionMetrics {
  readonly nodeCount: number;
  readonly maxDepth: number;
}

export const CONDITION_OPERATOR_OPTIONS = {
  STRING: [
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
    'EXISTS',
    'NOT_EXISTS'
  ],
  NUMBER: [
    'NUM_EQ',
    'NUM_NE',
    'NUM_GT',
    'NUM_GE',
    'NUM_LT',
    'NUM_LE',
    'NUM_BETWEEN',
    'NUM_IN',
    'NUM_NOT_IN',
    'EQ',
    'NE',
    'CONTAINS',
    'NOT_CONTAINS',
    'IN',
    'NOT_IN',
    'EXISTS',
    'NOT_EXISTS'
  ],
  BOOLEAN: ['EQ', 'NE', 'EXISTS', 'NOT_EXISTS'],
  DATE: [
    'DAY_OF_WEEK_IN',
    'IS_WORKDAY',
    'IS_NON_WORKDAY',
    'EQ',
    'NE',
    'GT',
    'GE',
    'LT',
    'LE',
    'BETWEEN',
    'EXISTS',
    'NOT_EXISTS'
  ],
  DATETIME: [
    'DAY_OF_WEEK_IN',
    'IS_WORKDAY',
    'IS_NON_WORKDAY',
    'EQ',
    'NE',
    'GT',
    'GE',
    'LT',
    'LE',
    'BETWEEN',
    'EXISTS',
    'NOT_EXISTS'
  ],
  DAY_OF_WEEK: ['EQ', 'NE', 'IN', 'NOT_IN'],
  TIME: ['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'BETWEEN']
} as const satisfies Record<ConditionFieldType, readonly ConditionOperator[]>;

export function getConditionOperators(field: ConditionField): readonly ConditionOperator[] {
  return CONDITION_OPERATOR_OPTIONS[field.type];
}

export function getConditionOperatorGroup(
  operator: ConditionOperator,
  fieldType?: ConditionFieldType
): string | undefined {
  if (isDecimalConditionOperator(operator)) return '数字';
  if (operator === 'EXISTS' || operator === 'NOT_EXISTS') return undefined;
  if (fieldType === 'BOOLEAN') return '布尔';
  if (
    ['DATE', 'DATETIME', 'DAY_OF_WEEK', 'TIME'].includes(fieldType ?? '') ||
    ['GT', 'GE', 'LT', 'LE', 'BETWEEN', 'DAY_OF_WEEK_IN', 'IS_WORKDAY', 'IS_NON_WORKDAY'].includes(
      operator
    )
  )
    return '日期';
  return '文本';
}

export function createAlwaysCondition(): AlwaysCondition {
  return { clientId: createConditionClientId('condition'), type: 'ALWAYS' };
}

export function createGroupCondition(field: ConditionField | string = ''): GroupCondition {
  return {
    clientId: createConditionClientId('condition'),
    type: 'GROUP',
    logic: 'AND',
    children: [createPredicateCondition(field)]
  };
}

export function createPredicateCondition(
  field: ConditionField | string = '',
  clientId = createConditionClientId('condition'),
  operator: ConditionOperator = typeof field === 'string'
    ? 'EQ'
    : CONDITION_OPERATOR_OPTIONS[field.type][0]
): PredicateCondition {
  const base = {
    clientId,
    type: 'CONDITION',
    field: typeof field === 'string' ? field : field.path,
    operator
  } as const;
  if (routingOperatorUsesNoValue(operator)) return base;
  if (operator === 'BETWEEN' || operator === 'NUM_BETWEEN') {
    return { ...base, values: ['', ''] };
  }
  if (
    operator === 'IN' ||
    operator === 'NOT_IN' ||
    operator === 'NUM_IN' ||
    operator === 'NUM_NOT_IN' ||
    operator === 'DAY_OF_WEEK_IN'
  ) {
    return {
      ...base,
      values:
        (typeof field !== 'string' && field.type === 'DAY_OF_WEEK') || operator === 'DAY_OF_WEEK_IN'
          ? []
          : ['']
    };
  }
  return { ...base, value: typeof field !== 'string' && field.type === 'BOOLEAN' ? true : '' };
}

export function getConditionField(
  catalog: readonly ConditionField[],
  path: string
): ConditionField | undefined {
  return catalog.find((field) => field.path === path);
}

export function isConditionFieldSelectable(field: ConditionField): boolean {
  return field.selectable !== false;
}

export function supportsConditionFieldReference(operator: ConditionOperator): boolean {
  return operator === 'EQ' || operator === 'NE';
}

export function getConditionFieldReferenceOptions(
  catalog: readonly ConditionField[],
  field: ConditionField
): readonly ConditionField[] {
  const effectiveType = getEffectiveRoutingFieldType(field.type);
  return catalog.filter(
    (candidate) =>
      candidate.path !== field.path &&
      candidate.selectable !== false &&
      (candidate.source === 'PAYLOAD' || candidate.source === 'CONTEXT') &&
      getEffectiveRoutingFieldType(candidate.type) === effectiveType
  );
}

function getEffectiveRoutingFieldType(type: ConditionFieldType): string {
  return type === 'NUMBER' ? 'STRING' : type;
}

export function getConditionMetrics(condition: ConditionNode): ConditionMetrics {
  if (condition.type !== 'GROUP') return { nodeCount: 1, maxDepth: 1 };
  const childMetrics = condition.children.map(getConditionMetrics);
  return {
    nodeCount: 1 + childMetrics.reduce((total, metrics) => total + metrics.nodeCount, 0),
    maxDepth: 1 + Math.max(0, ...childMetrics.map((metrics) => metrics.maxDepth))
  };
}

export function isDecimalConditionOperator(operator: ConditionOperator): boolean {
  return (
    operator === 'NUM_EQ' ||
    operator === 'NUM_NE' ||
    operator === 'NUM_GT' ||
    operator === 'NUM_GE' ||
    operator === 'NUM_LT' ||
    operator === 'NUM_LE' ||
    operator === 'NUM_BETWEEN' ||
    operator === 'NUM_IN' ||
    operator === 'NUM_NOT_IN'
  );
}

let routingClientSequence = 0;

export function createConditionClientId(prefix: string): string {
  routingClientSequence += 1;
  return `${prefix}-${routingClientSequence}`;
}

export function routingOperatorUsesNoValue(operator: ConditionOperator): boolean {
  return (
    operator === 'EXISTS' ||
    operator === 'NOT_EXISTS' ||
    operator === 'IS_WORKDAY' ||
    operator === 'IS_NON_WORKDAY'
  );
}

export interface ConditionIssue {
  readonly path: string;
  readonly message: string;
}
