import type { Column } from '@tanstack/react-table';
import type { FC, SVGProps } from 'react';

/** DataTable 筛选项；避免与表单等领域的通用 Option 混淆。 */
export interface DataTableFilterOption {
  label: string;
  value: string;
  /** 参与筛选搜索但不展示的领域编码、别名等关键词。 */
  keywords?: readonly string[];
  count?: number;
  icon?: FC<SVGProps<SVGSVGElement>>;
}

/** @deprecated 使用 DataTableFilterOption。 */
export type Option = DataTableFilterOption;

export interface DataTableTreeFilterOption extends DataTableFilterOption {
  depth: number;
}

/** @deprecated 使用 DataTableTreeFilterOption。 */
export type TreeOption = DataTableTreeFilterOption;

export type DataTableTreeSelectionMode = 'cascade' | 'independent';

export type DataTableFilterOptions =
  | readonly DataTableFilterOption[]
  | {
      kind: 'tree';
      options: readonly DataTableTreeFilterOption[];
      selectionMode?: DataTableTreeSelectionMode;
    };

export type FilterOperator =
  | 'iLike'
  | 'notILike'
  | 'eq'
  | 'ne'
  | 'inArray'
  | 'notInArray'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'isBetween'
  | 'isRelativeToToday';

export type FilterVariant =
  | 'text'
  | 'number'
  | 'range'
  | 'date'
  | 'dateRange'
  | 'boolean'
  | 'select'
  | 'multiSelect';

export type DataTableDslOperator =
  | 'EQ'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'BETWEEN';

export type DataTableDslFilterNodeType = 'text' | 'enum';

export type DataTableColumnFilterVariant =
  | 'text'
  | 'select'
  | 'multiSelect'
  | 'date'
  | 'dateRange'
  | 'number'
  | 'numberRange'
  | 'boolean';

export type DataTableLocalFilterCandidateValue<TValue> = [NonNullable<TValue>] extends [
  readonly (infer TElement)[]
]
  ? TElement
  : TValue;

export interface DataTableLocalFilterMeta<TData = unknown> {
  variant: FilterVariant;
  placeholder?: string;
  options?: DataTableFilterOption[];
  range?: [number, number];
  unit?: string;
  formatValue?: (value: unknown, row: TData) => unknown;
}

export interface DataTableLocalFilterOption {
  key: string;
  label: string;
}

export interface DataTableLocalSetFilterValue {
  kind: 'set';
  selectedKeys: string[];
}

export interface DataTableLocalColumnFilter {
  id: string;
  value: DataTableLocalSetFilterValue;
}

export interface DataTableLocalFilteringRuntime {
  filters: readonly DataTableLocalColumnFilter[];
  getFilterOptions: (columnId: string) => readonly DataTableLocalFilterOption[];
  getFilterValue: (columnId: string) => DataTableLocalSetFilterValue | undefined;
  setFilterValue: (columnId: string, value: DataTableLocalSetFilterValue | undefined) => void;
  reset: () => void;
}

export interface DataTableColumnFilterOptions<TData = unknown, TValue = unknown> {
  filter?: false | DataTableColumnFilterVariant;
  filterPlaceholder?: string;
  filterOptions?: DataTableFilterOptions;
  filterMin?: number | Date;
  filterMax?: number | Date;
  filterUnit?: string;
  localFilter?: false | DataTableColumnFilterVariant;
  localFilterPlaceholder?: string;
  localFilterOptions?: readonly DataTableFilterOption[];
  localFilterFormat?: (value: DataTableLocalFilterCandidateValue<TValue>, row: TData) => unknown;
  localFilterMin?: number;
  localFilterMax?: number;
  localFilterUnit?: string;
}

export interface DataTableColumnDslQueryOptions<TData, TValue> {
  dsl?: {
    filterNodeType?: DataTableDslFilterNodeType;
    filterField?: string;
    sortField?: string;
    filterOperator?: DataTableDslOperator;
    serializeFilter?: (value: unknown, column: Column<TData, TValue>) => unknown;
  };
}
