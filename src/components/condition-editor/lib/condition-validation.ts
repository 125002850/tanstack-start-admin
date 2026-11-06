import { isConditionDate, isConditionDateTime } from './condition-date-time';
import {
  CONDITION_INPUT_OPERATORS,
  conditionOperatorUsesCollection,
  isDateConditionInputOperator,
  parseConditionLiteral
} from './condition-operands';
import { CONDITION_LIMITS } from '../model/condition-limits';
import {
  getConditionField,
  getConditionFieldReferenceOptions,
  getConditionOperators,
  isDecimalConditionOperator,
  routingOperatorUsesNoValue,
  supportsConditionFieldReference,
  type ConditionNode,
  type ConditionField,
  type ConditionIssue,
  type ConditionOperator
} from '../model/condition-model';
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/;
const DAYS_OF_WEEK = new Set([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
]);
export function validateConditionTree(
  condition: ConditionNode,
  catalog: readonly ConditionField[],
  path = 'condition'
): readonly ConditionIssue[] {
  const issues: ConditionIssue[] = [];
  validateCondition(condition, catalog, path, 1, true, issues);
  return issues;
}
export function validateCondition(
  condition: ConditionNode,
  catalog: readonly ConditionField[],
  path: string,
  depth: number,
  root: boolean,
  issues: ConditionIssue[]
): number {
  if (depth > CONDITION_LIMITS.conditionDepth) {
    issues.push({ path, message: '条件树最大深度为 5 层。' });
  }
  if (condition.type === 'ALWAYS') {
    if (!root) issues.push({ path, message: '始终命中只能作为规则根条件。' });
    return 1;
  }
  if (condition.type === 'GROUP') {
    if (condition.children.length === 0 || condition.children.length > 32) {
      issues.push({ path: `${path}.children`, message: '条件组需包含 1 至 32 个直接子条件。' });
    }
    const count =
      1 +
      condition.children.reduce(
        (total, child, index) =>
          total +
          validateCondition(child, catalog, `${path}.children.${index}`, depth + 1, false, issues),
        0
      );
    if (count > CONDITION_LIMITS.conditionNodes) {
      issues.push({ path, message: '单棵条件树最多支持 64 个节点。' });
    }
    return count;
  }

  if (condition.leftValue !== undefined || condition.rightValue !== undefined) {
    validateInputOperands(condition, path, issues);
    return 1;
  }
  const field = getConditionField(catalog, condition.field);
  if (condition.field.length > CONDITION_LIMITS.fieldPathLength || field === undefined) {
    issues.push({
      path: `${path}.field`,
      message: '请选择可用目录中的标量字段。'
    });
    return 1;
  }
  if (!getConditionOperators(field).includes(condition.operator)) {
    issues.push({ path: `${path}.operator`, message: '操作符与字段类型不兼容。' });
  }
  validateConditionPayload(condition, catalog, field, path, issues);
  return 1;
}

function validateInputOperands(
  condition: Extract<ConditionNode, { type: 'CONDITION' }>,
  path: string,
  issues: ConditionIssue[]
) {
  if (!(CONDITION_INPUT_OPERATORS as readonly ConditionOperator[]).includes(condition.operator)) {
    issues.push({ path: `${path}.operator`, message: '当前输入条件不支持此操作符。' });
  }
  const noValue = routingOperatorUsesNoValue(condition.operator);
  const collection = conditionOperatorUsesCollection(condition.operator);
  const numeric = isDecimalConditionOperator(condition.operator);
  const temporal = isDateConditionInputOperator(condition.operator);
  if (condition.setRef !== undefined) {
    if (
      !['IN', 'NOT_IN'].includes(condition.operator) ||
      condition.rightValue !== undefined ||
      condition.value !== undefined ||
      condition.values !== undefined ||
      condition.fieldRef !== undefined
    )
      issues.push({
        path,
        message: '引用数据集合仅用于文本属于或不属于，且不能同时填写其他右值。'
      });
    if (!condition.setRef.trim() || condition.setRef.length > 128)
      issues.push({ path: `${path}.setRef`, message: '请选择引用集合。' });
  }
  for (const key of ['leftValue', 'rightValue'] as const) {
    if (key === 'rightValue' && (noValue || condition.setRef !== undefined)) continue;
    const source = condition[key];
    const issuePath = `${path}.${key}`;
    if (typeof source !== 'string' || (key === 'leftValue' && !source.trim())) {
      issues.push({
        path: issuePath,
        message: key === 'leftValue' ? '请填写条件左值。' : '请填写条件右值。'
      });
      continue;
    }
    if (source.length > CONDITION_LIMITS.stringValueLength) {
      issues.push({ path: issuePath, message: '单个输入不能超过 512 个字符。' });
      continue;
    }
    if (source.includes('{{') && !source.trim().startsWith('"') && !source.trim().startsWith('['))
      continue;
    try {
      const literal = parseConditionLiteral(source);
      const expectsArray = key === 'rightValue' && collection;
      const values = expectsArray && Array.isArray(literal) ? literal : [literal];
      if (
        expectsArray &&
        (!Array.isArray(literal) ||
          literal.length === 0 ||
          literal.length > CONDITION_LIMITS.collectionValues ||
          (condition.operator.endsWith('BETWEEN') && literal.length !== 2))
      ) {
        throw new Error('集合填写 1 至 100 项的 JSON 数组，区间填写两个值。');
      }
      if (values.some((item) => !['string', 'boolean', 'number'].includes(typeof item)))
        throw new Error('条件值须为文本、数字或布尔值。');
      if (
        numeric &&
        values.some(
          (item) =>
            typeof item === 'boolean' ||
            (!(Array.isArray(literal) && typeof item === 'string' && item.includes('{{')) &&
              !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(item)))
        )
      )
        throw new Error('数字常量必须使用有效的十进制字符串。');
      if (
        temporal &&
        values.some(
          (item) =>
            !(typeof item === 'string' && Array.isArray(literal) && item.includes('{{')) &&
            !(
              typeof item === 'string' &&
              isConditionDate(item.slice(0, 10)) &&
              (isConditionDate(item) || isConditionDateTime(item))
            )
        )
      )
        throw new Error('日期比较须使用 yyyy-MM-dd、yyyy-MM-dd HH:mm:ss 或带时区的 ISO 日期时间。');
    } catch (error) {
      issues.push({
        path: issuePath,
        message:
          error instanceof SyntaxError
            ? '固定集合或带引号的文本须使用有效 JSON。'
            : error instanceof Error
              ? error.message
              : '条件值无效。'
      });
    }
  }
}

function validateConditionPayload(
  condition: Extract<ConditionNode, { type: 'CONDITION' }>,
  catalog: readonly ConditionField[],
  field: NonNullable<ReturnType<typeof getConditionField>>,
  path: string,
  issues: ConditionIssue[]
): void {
  if (condition.setRef !== undefined) {
    if (
      (condition.operator !== 'IN' && condition.operator !== 'NOT_IN') ||
      field.type !== 'STRING' ||
      condition.value !== undefined ||
      condition.values !== undefined ||
      condition.fieldRef !== undefined
    ) {
      issues.push({
        path,
        message: '引用集合仅用于文本属于或不属于判断，且不能同时填写固定值或字段引用。'
      });
    }
    if (!condition.setRef.trim() || condition.setRef.length > 128) {
      issues.push({ path: `${path}.setRef`, message: '请选择引用集合。' });
    }
    return;
  }
  if (condition.fieldRef !== undefined) {
    const fieldRef = getConditionField(catalog, condition.fieldRef);
    if (
      !supportsConditionFieldReference(condition.operator) ||
      condition.value !== undefined ||
      condition.values !== undefined
    ) {
      issues.push({ path, message: '只有等于和不等于可选择对比字段，且不能同时填写固定值。' });
    }
    if (
      condition.fieldRef.length === 0 ||
      condition.fieldRef.length > CONDITION_LIMITS.fieldPathLength ||
      fieldRef === undefined ||
      !getConditionFieldReferenceOptions(catalog, field).some(
        (candidate) => candidate.path === condition.fieldRef
      )
    ) {
      issues.push({ path: `${path}.fieldRef`, message: '请选择类型兼容的对比字段。' });
    }
    return;
  }
  const expectsNoValue = routingOperatorUsesNoValue(condition.operator);
  const expectsValues =
    condition.operator === 'IN' ||
    condition.operator === 'NOT_IN' ||
    condition.operator === 'BETWEEN' ||
    condition.operator === 'NUM_IN' ||
    condition.operator === 'NUM_NOT_IN' ||
    condition.operator === 'NUM_BETWEEN' ||
    condition.operator === 'DAY_OF_WEEK_IN';
  if (expectsNoValue) {
    if (condition.value !== undefined || condition.values !== undefined) {
      issues.push({ path, message: '当前操作符无需比较值，不能携带常量。' });
    }
    return;
  }
  if (expectsValues) {
    const values = condition.values ?? [];
    const expectedCount =
      condition.operator === 'BETWEEN' || condition.operator === 'NUM_BETWEEN' ? 2 : null;
    if (
      values.length === 0 ||
      values.length > CONDITION_LIMITS.collectionValues ||
      (expectedCount !== null && values.length !== expectedCount)
    ) {
      issues.push({ path: `${path}.values`, message: '请填写符合当前操作符数量要求的常量集合。' });
    }
    values.forEach((value, index) =>
      validateLiteral(value, field.type, condition.operator, `${path}.values.${index}`, issues)
    );
    return;
  }
  if (condition.value === undefined) {
    issues.push({ path: `${path}.value`, message: '请填写比较常量。' });
    return;
  }
  validateLiteral(condition.value, field.type, condition.operator, `${path}.value`, issues);
}

function validateLiteral(
  value: string | boolean,
  fieldType: string,
  operator: ConditionOperator,
  path: string,
  issues: ConditionIssue[]
): void {
  const expected = fieldType === 'BOOLEAN' ? 'boolean' : 'string';
  if (typeof value !== expected) {
    issues.push({ path, message: '常量类型必须与字段类型严格一致。' });
  }
  if (typeof value === 'string' && value.length > CONDITION_LIMITS.stringValueLength) {
    issues.push({ path, message: '单个字符串常量不能超过 512 个字符。' });
  }
  if (
    isDecimalConditionOperator(operator) &&
    typeof value === 'string' &&
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)
  ) {
    issues.push({ path, message: '数字常量必须使用有效的十进制字符串。' });
  }
  if (
    fieldType === 'DATE' &&
    operator !== 'DAY_OF_WEEK_IN' &&
    typeof value === 'string' &&
    !isConditionDate(value)
  ) {
    issues.push({ path, message: '日期必须使用 yyyy-MM-dd 格式。' });
  }
  if (
    fieldType === 'DATETIME' &&
    operator !== 'DAY_OF_WEEK_IN' &&
    typeof value === 'string' &&
    !isConditionDateTime(value)
  ) {
    issues.push({ path, message: '时间点必须使用 yyyy-MM-dd HH:mm:ss 格式，默认Asia/Shanghai。' });
  }
  if (fieldType === 'TIME' && typeof value === 'string' && !TIME_PATTERN.test(value)) {
    issues.push({ path, message: '日内时间必须使用 HH:mm、HH:mm:ss 或带小数秒格式。' });
  }
  if (
    (fieldType === 'DAY_OF_WEEK' || operator === 'DAY_OF_WEEK_IN') &&
    typeof value === 'string' &&
    !DAYS_OF_WEEK.has(value)
  ) {
    issues.push({ path, message: '星期常量必须使用固定英文枚举。' });
  }
}
