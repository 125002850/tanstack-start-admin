/**
 * DataTable 公共类型兼容门面。
 *
 * 新的 DataTable 内部代码应从对应领域的 types.ts 直接导入；业务调用方可继续使用本入口。
 */
export * from '@/components/data-table/actions/types';
export * from '@/components/data-table/columns/dsl/contracts';
export * from '@/components/data-table/core/types';
export * from '@/components/data-table/editing/choice/types';
export * from '@/components/data-table/editing/types';
export { defineExpandConfig } from '@/components/data-table/expand/model';
export * from '@/components/data-table/expand/types';
export { isDataTableFlatFilterOptions } from '@/components/data-table/filters/model';
export * from '@/components/data-table/filters/types';
export * from '@/components/data-table/virtualization/types';
