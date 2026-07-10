import type { ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import type {
  DataTableDslCondition,
  DataTableDslPageRequestBase
} from '@/hooks/use-dsl-data-table.dsl';
import type { DateTimeRangeReqDTO } from '@/lib/api/clients/service';

export function pageRequestFromPagination(pagination: PaginationState) {
  return {
    pageNo: pagination.pageIndex + 1,
    pageSize: pagination.pageSize
  };
}

export function textFilter(filters: ColumnFiltersState, id: string) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function selectFilter(filters: ColumnFiltersState, id: string) {
  const value = filters.find((filter) => filter.id === id)?.value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function numberFilter(filters: ColumnFiltersState, id: string) {
  const value = selectFilter(filters, id);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function dslConditionValue(
  condition: DataTableDslCondition | undefined,
  field: string
): string | undefined {
  if (!condition) return undefined;
  if (condition.nodeType === 'compose') {
    for (const child of condition.children) {
      const value: string | undefined = dslConditionValue(child, field);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  return condition.field === field ? condition.value : undefined;
}

export function dslConditionNumber(condition: DataTableDslCondition | undefined, field: string) {
  const value = dslConditionValue(condition, field);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function dslConditionValues(
  condition: DataTableDslCondition | undefined,
  field: string
): string[] | undefined {
  if (!condition) return undefined;
  if (condition.nodeType === 'compose') {
    for (const child of condition.children) {
      const values = dslConditionValues(child, field);
      if (values?.length) return values;
    }
    return undefined;
  }
  if (condition.nodeType !== 'text' || condition.field !== field) return undefined;
  if (condition.values?.length) return condition.values;
  return condition.value ? [condition.value] : undefined;
}

export function dslConditionNumbers(
  condition: DataTableDslCondition | undefined,
  field: string
): number[] | undefined {
  const numbers = dslConditionValues(condition, field)?.map(Number).filter(Number.isFinite);
  return numbers?.length ? numbers : undefined;
}

export function dslDateTimeRange(
  condition: DataTableDslCondition | undefined,
  field: string
): DateTimeRangeReqDTO | undefined {
  if (!condition) return undefined;
  if (condition.nodeType === 'compose') {
    for (const child of condition.children) {
      const value: DateTimeRangeReqDTO | undefined = dslDateTimeRange(child, field);
      if (value) return value;
    }
    return undefined;
  }
  if (condition.nodeType !== 'dateTime' || condition.field !== field) return undefined;
  if (condition.op === 'BETWEEN') {
    return {
      startTime: condition.start,
      endTime: condition.end
    };
  }
  if (condition.op === 'GTE' || condition.op === 'GT') {
    return { startTime: condition.value };
  }
  if (condition.op === 'LTE' || condition.op === 'LT') {
    return { endTime: condition.value };
  }
  return undefined;
}

export function pageRequestFromDsl(request: DataTableDslPageRequestBase) {
  return {
    pageNo: request.pageNo,
    pageSize: request.pageSize
  };
}
