import { endOfDay, format, startOfDay } from 'date-fns';
import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';

import type { DataTableDslCondition, DataTableDslQuickCondition } from '@/hooks/use-data-table';
import type {
  DataTableAdvancedSearchConfig,
  DataTableAdvancedSearchField,
  DataTableDslConditionType,
  DataTableDslOperator,
  DataTableFilterOptions,
  DataTableQueryScheme
} from '@/types/data-table';
import type { QuerySceneFieldRspDTO, QuerySceneLimitsRspDTO } from '@/lib/api/clients/service';
import { restoreDataTableColumnFilters } from '@/hooks/use-data-table/dsl';

export const ADVANCED_SEARCH_MAX_DEPTH = 4;
export const ADVANCED_SEARCH_MAX_NODES = 20;
export const ADVANCED_SEARCH_MAX_IN_SIZE = 1000;
export const DEFAULT_ADVANCED_SEARCH_LIMITS: QuerySceneLimitsRspDTO = {
  maxDepth: ADVANCED_SEARCH_MAX_DEPTH,
  maxNodes: ADVANCED_SEARCH_MAX_NODES,
  maxInSize: ADVANCED_SEARCH_MAX_IN_SIZE,
  maxComplexityScore: 100
};

const DEFAULT_OPERATORS = {
  text: [
    'EQ',
    'NE',
    'CONTAINS',
    'NOT_CONTAINS',
    'STARTS_WITH',
    'ENDS_WITH',
    'IN',
    'NOT_IN',
    'IS_NULL',
    'IS_NOT_NULL'
  ],
  enum: ['EQ', 'NE', 'IN', 'NOT_IN', 'IS_NULL', 'IS_NOT_NULL'],
  boolean: ['EQ', 'NE', 'IS_NULL', 'IS_NOT_NULL'],
  dateTime: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL'],
  number: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL']
} satisfies Record<DataTableDslConditionType, DataTableDslOperator[]>;

export const DATA_TABLE_OPERATOR_LABELS: Record<DataTableDslOperator, string> = {
  EQ: '等于',
  NE: '不等于',
  CONTAINS: '包含',
  NOT_CONTAINS: '不包含',
  STARTS_WITH: '开头是',
  ENDS_WITH: '结尾是',
  IN: '属于',
  NOT_IN: '不属于',
  GT: '大于',
  GTE: '大于等于',
  LT: '小于',
  LTE: '小于等于',
  BETWEEN: '范围',
  IS_NULL: '为空',
  IS_NOT_NULL: '不为空'
};

export interface DataTableQuerySchemeContent {
  schemaVersion: 1;
  quickConditions: DataTableDslQuickCondition[];
  advancedCondition?: DataTableDslCondition;
}

function getColumnId<TData>(column: ColumnDef<TData>) {
  if (typeof column.id === 'string' && column.id) return column.id;
  if ('accessorKey' in column && typeof column.accessorKey === 'string' && column.accessorKey) {
    return column.accessorKey;
  }
  return undefined;
}

function resolveAdvancedSearchOptions(options: DataTableFilterOptions | undefined) {
  if (!options) return [];
  return [...(Array.isArray(options) ? options : 'kind' in options ? options.options : [])];
}

export function resolveAdvancedSearchFields<TData>(
  columns: Array<ColumnDef<TData>>,
  configuredFields?: Readonly<Record<string, DataTableAdvancedSearchConfig>>,
  sceneFields?: Readonly<Record<string, QuerySceneFieldRspDTO>>
): DataTableAdvancedSearchField[] {
  if (sceneFields) {
    const columnsByField = new Map(
      columns.map((column) => [
        column.meta?.advancedSearch?.field ??
          column.meta?.query?.filterField ??
          getColumnId(column),
        column
      ])
    );
    return Object.entries(sceneFields).flatMap(([field, spec]) => {
      const column = columnsByField.get(field);
      // 后端决定字段类型和比较符；本地配置仅能进一步收窄，不能放开后端禁止的能力。
      const local = column?.meta?.advancedSearch ?? configuredFields?.[field];
      const operators = DEFAULT_OPERATORS[spec.conditionType].filter(
        (operator) =>
          spec.operators.includes(operator) &&
          (!local?.operators || local.operators.includes(operator))
      );
      if (!operators.length) return [];
      return [
        {
          columnId: column ? (getColumnId(column) ?? field) : field,
          field,
          label: column?.meta?.label?.trim() || spec.label || field,
          conditionType: spec.conditionType,
          operators,
          options: resolveAdvancedSearchOptions(column?.meta?.options).length
            ? resolveAdvancedSearchOptions(column?.meta?.options)
            : Object.entries(spec.valueLabels).map(([value, label]) => ({ value, label })),
          dateMode:
            column?.meta?.variant === 'date' || column?.meta?.variant === 'dateRange'
              ? ('date' as const)
              : ('dateTime' as const)
        }
      ];
    });
  }
  return columns.flatMap((column) => {
    const columnId = getColumnId(column);
    const fieldKey = column.meta?.query?.filterField ?? columnId;
    const config =
      column.meta?.advancedSearch ?? (fieldKey ? configuredFields?.[fieldKey] : undefined);
    if (!columnId || !config) return [];
    const defaults = DEFAULT_OPERATORS[config.conditionType];
    const operators = config.operators
      ? defaults.filter((operator) => config.operators!.includes(operator))
      : defaults;
    if (operators.length === 0) return [];
    return [
      {
        columnId,
        field: config.field || column.meta?.query?.filterField || columnId,
        label: column.meta?.label?.trim() || columnId,
        conditionType: config.conditionType,
        operators: [...operators],
        options: resolveAdvancedSearchOptions(column.meta?.options),
        dateMode:
          column.meta?.variant === 'date' || column.meta?.variant === 'dateRange'
            ? ('date' as const)
            : ('dateTime' as const)
      }
    ];
  });
}

export function createAdvancedCondition(
  field: DataTableAdvancedSearchField
): DataTableDslCondition {
  const op = field.operators[0] ?? 'EQ';
  switch (field.conditionType) {
    case 'text':
      return { nodeType: 'text', field: field.field, op: op as never, value: '' };
    case 'enum':
      return { nodeType: 'enum', field: field.field, op: op as never, value: '' };
    case 'boolean':
      return { nodeType: 'boolean', field: field.field, op: op as never, value: true };
    case 'number':
      return { nodeType: 'number', field: field.field, op: op as never };
    case 'dateTime':
      return { nodeType: 'dateTime', field: field.field, op: op as never, value: '' };
  }
}

function formatBackendDateTime(value: string, boundary?: 'start' | 'end') {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  let resolved = parsed;
  if (boundary === 'start') resolved = startOfDay(parsed);
  if (boundary === 'end') resolved = endOfDay(parsed);
  return format(resolved, 'yyyy-MM-dd HH:mm:ss');
}

function scalarPresent(value: unknown) {
  return typeof value === 'string'
    ? value.trim().length > 0
    : value !== undefined && value !== null;
}

function normalizeLeaf(
  condition: Exclude<DataTableDslCondition, { nodeType: 'compose' }>,
  field: DataTableAdvancedSearchField,
  limits: QuerySceneLimitsRspDTO
): DataTableDslCondition | undefined {
  if (!field.operators.includes(condition.op)) return undefined;
  if (condition.op === 'IS_NULL' || condition.op === 'IS_NOT_NULL') {
    return {
      nodeType: condition.nodeType,
      field: field.field,
      op: condition.op
    } as DataTableDslCondition;
  }

  if (condition.nodeType === 'number') {
    if (condition.op === 'BETWEEN') {
      return Number.isFinite(condition.start) &&
        Number.isFinite(condition.end) &&
        condition.start! <= condition.end!
        ? { ...condition, field: field.field }
        : undefined;
    }
    return Number.isFinite(condition.value) ? { ...condition, field: field.field } : undefined;
  }

  if (condition.nodeType === 'dateTime') {
    if (condition.op === 'BETWEEN') {
      const start = condition.start
        ? formatBackendDateTime(condition.start, field.dateMode === 'date' ? 'start' : undefined)
        : undefined;
      const end = condition.end
        ? formatBackendDateTime(condition.end, field.dateMode === 'date' ? 'end' : undefined)
        : undefined;
      return start && end && start <= end
        ? { ...condition, field: field.field, start, end }
        : undefined;
    }
    if (!condition.value) return undefined;
    if (field.dateMode === 'date') {
      const start = formatBackendDateTime(condition.value, 'start');
      const end = formatBackendDateTime(condition.value, 'end');
      if (!start || !end) return undefined;
      if (condition.op === 'EQ') {
        return { nodeType: 'dateTime', field: field.field, op: 'BETWEEN', start, end };
      }
      if (condition.op === 'NE') {
        return {
          nodeType: 'compose',
          logic: 'OR',
          children: [
            { nodeType: 'dateTime', field: field.field, op: 'LT', value: start },
            { nodeType: 'dateTime', field: field.field, op: 'GT', value: end }
          ]
        };
      }
      const value = condition.op === 'GT' || condition.op === 'LTE' ? end : start;
      return { ...condition, field: field.field, value };
    }
    const value = formatBackendDateTime(condition.value);
    return value ? { ...condition, field: field.field, value } : undefined;
  }

  if (condition.nodeType === 'boolean') {
    return typeof condition.value === 'boolean' ? { ...condition, field: field.field } : undefined;
  }

  if (condition.op === 'IN' || condition.op === 'NOT_IN') {
    const values = condition.values?.filter(scalarPresent);
    if ((condition.values?.length ?? 0) > limits.maxInSize) return undefined;
    if (!values?.length) return undefined;
    return condition.nodeType === 'text'
      ? { ...condition, field: field.field, values: values.map(String) }
      : { ...condition, field: field.field, values };
  }
  return scalarPresent(condition.value) ? { ...condition, field: field.field } : undefined;
}

export function normalizeAdvancedCondition(
  condition: DataTableDslCondition | undefined,
  fields: DataTableAdvancedSearchField[],
  depth = 1,
  limits = DEFAULT_ADVANCED_SEARCH_LIMITS
): DataTableDslCondition | undefined {
  if (!condition || depth > limits.maxDepth) return undefined;
  if (condition.nodeType === 'compose') {
    const children = condition.children
      .map((child) => normalizeAdvancedCondition(child, fields, depth + 1, limits))
      .filter((child): child is DataTableDslCondition => Boolean(child));
    return children.length ? { ...condition, children } : undefined;
  }
  const field = fields.find(
    (candidate) =>
      candidate.field === condition.field && candidate.conditionType === condition.nodeType
  );
  return field ? normalizeLeaf(condition, field, limits) : undefined;
}

export function countAdvancedConditions(condition?: DataTableDslCondition): number {
  if (!condition) return 0;
  return condition.nodeType === 'compose'
    ? condition.children.reduce((total, child) => total + countAdvancedConditions(child), 0)
    : 1;
}

export function summarizeAdvancedCondition(
  condition: DataTableDslCondition | undefined,
  fields: DataTableAdvancedSearchField[]
) {
  if (!condition) return '';
  const parts: string[] = [];
  const visit = (node: DataTableDslCondition) => {
    if (node.nodeType === 'compose') {
      node.children.forEach(visit);
      return;
    }
    const label = fields.find((field) => field.field === node.field)?.label ?? node.field;
    parts.push(`${label}${DATA_TABLE_OPERATOR_LABELS[node.op]}`);
  };
  visit(condition);
  return parts.length > 3
    ? `${parts.slice(0, 3).join('、')}等 ${parts.length} 项`
    : parts.join('、');
}

export function buildQuerySchemeContent(
  quickConditions: DataTableDslQuickCondition[],
  advancedCondition?: DataTableDslCondition
): DataTableQuerySchemeContent {
  return {
    schemaVersion: 1,
    quickConditions,
    ...(advancedCondition ? { advancedCondition } : {})
  };
}

export function parseQuerySchemeContent(
  scheme: DataTableQueryScheme,
  fields: DataTableAdvancedSearchField[],
  columns: Array<ColumnDef<unknown>>,
  limits = DEFAULT_ADVANCED_SEARCH_LIMITS
): { content: DataTableQuerySchemeContent; columnFilters: ColumnFiltersState } | undefined {
  try {
    const parsed = JSON.parse(scheme.contentJson) as Partial<DataTableQuerySchemeContent>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.quickConditions)) return undefined;
    const columnFilters = restoreDataTableColumnFilters(columns, parsed.quickConditions);
    if (!columnFilters) return undefined;
    if (parsed.advancedCondition) {
      const normalized = normalizeAdvancedCondition(parsed.advancedCondition, fields, 1, limits);
      if (!normalized || JSON.stringify(normalized) !== JSON.stringify(parsed.advancedCondition)) {
        return undefined;
      }
    }
    return { content: parsed as DataTableQuerySchemeContent, columnFilters };
  } catch {
    return undefined;
  }
}

export function resolveQuerySchemes(value: unknown): DataTableQueryScheme[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const scheme = item as Partial<DataTableQueryScheme>;
    if (
      typeof scheme.id !== 'number' ||
      typeof scheme.sceneCode !== 'string' ||
      typeof scheme.schemeName !== 'string' ||
      typeof scheme.contentJson !== 'string' ||
      typeof scheme.version !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: scheme.id,
        sceneCode: scheme.sceneCode,
        schemeName: scheme.schemeName,
        contentJson: scheme.contentJson,
        schemaVersion: scheme.schemaVersion ?? 1,
        defaultScheme: scheme.defaultScheme ?? false,
        version: scheme.version
      }
    ];
  });
}

/** 校验最终请求，包括固定条件、快捷条件以及日期条件展开后的组合节点。 */
export function validateCombinedCondition(
  condition?: DataTableDslCondition,
  limits?: QuerySceneLimitsRspDTO
): string | undefined {
  const maxAllowedDepth = limits?.maxDepth ?? ADVANCED_SEARCH_MAX_DEPTH;
  const maxNodes = limits?.maxNodes ?? ADVANCED_SEARCH_MAX_NODES;
  const maxInSize = limits?.maxInSize ?? ADVANCED_SEARCH_MAX_IN_SIZE;
  let nodes = 0;
  let maxDepth = 0;
  let tooManyValues = false;
  const visit = (node: DataTableDslCondition, depth: number) => {
    nodes++;
    maxDepth = Math.max(maxDepth, depth);
    if (depth > maxAllowedDepth || nodes > maxNodes) return;
    if (node.nodeType === 'compose') node.children.forEach((child) => visit(child, depth + 1));
    else if ('values' in node && (node.values?.length ?? 0) > maxInSize) tooManyValues = true;
  };
  if (condition) visit(condition, 1);
  if (maxDepth > maxAllowedDepth)
    return `合并固定条件和快捷筛选后，查询条件超过 ${maxAllowedDepth} 层，请减少分组`;
  if (nodes > maxNodes)
    return `合并固定条件和快捷筛选后，查询条件超过 ${maxNodes} 个节点，请减少条件`;
  if (tooManyValues) return `单个条件最多允许 ${maxInSize} 个值`;
  return undefined;
}
