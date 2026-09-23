import type { Row } from '@tanstack/react-table';
import type { ReactNode } from 'react';

/** 分页主表的行内详情；详情内容由独立组件管理。 */
export interface DataTableRowDetailConfig<TData> {
  columnId: string;
  /** 默认所有行可展开；返回 false 时隐藏箭头和详情。 */
  canExpand?: (row: Row<TData>) => boolean;
  render: (context: { row: Row<TData> }) => ReactNode;
}
