import type { ReactNode } from 'react';
import type { RowSelectionState, Updater } from '@tanstack/react-table';

/** 展示、搜索和身份适配后的对象；original 保留完整业务数据。 */
export interface ObjectPickerItem<T> {
  key: string;
  label: string;
  code: string;
  original: T;
}

export interface ObjectPickerSelectionChange<T> {
  added: T[];
  removed: T[];
}

export interface ObjectPickerTableContext<T> {
  rowSelection: RowSelectionState;
  disabled: boolean;
  /** 必须传入当前表格页的原始行；全选/取消只影响这些行。 */
  onRowSelectionChange: (updater: Updater<RowSelectionState>, pageItems: readonly T[]) => void;
}

export interface ObjectPickerProps<T> {
  title: string;
  /** 受控的完整已选名单，不能只传当前页。 */
  selectedItems: readonly T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getCode: (item: T) => string;
  onSelectionChange: (items: T[], change: ObjectPickerSelectionChange<T>) => void | Promise<void>;
  renderTable: (context: ObjectPickerTableContext<T>) => ReactNode;
  /** 只替换内容，不嵌套按钮；删除交互、hover 和动画由选择器负责。 */
  renderSelectedItem?: (item: T) => ReactNode;
  additionalTabs?: readonly { value: string; label: string; content: ReactNode }[];
  busy?: boolean;
  selectedStatus?: { loading?: boolean; error?: ReactNode; onRetry?: () => void };
  confirmDisabled?: boolean;
  onConfirm: (items: T[]) => void | Promise<void>;
  onClose: () => void;
}
