import * as React from 'react';

import { Tree, type TreeItem } from '@/components/ui/tree';
import type { DeptRspDTO } from '@/lib/api/clients/service';

interface DepartmentTreeProps {
  departments: readonly DeptRspDTO[];
  rootItem?: Omit<TreeItem, 'children'>;
  searchQuery?: string;
  selectedDepartmentId: string | null;
  onSelect: (departmentId: string) => void;
}

function toDepartmentTreeItem(department: DeptRspDTO): TreeItem | null {
  if (department.deptId == null) return null;

  const fallbackLabel = department.deptCode ?? String(department.deptId);
  return {
    value: String(department.deptId),
    label: department.deptName ?? fallbackLabel,
    searchText: [department.deptName, department.deptCode, department.fullPath]
      .filter(Boolean)
      .join(' '),
    children: (department.children ?? []).flatMap((child) => {
      const item = toDepartmentTreeItem(child);
      return item ? [item] : [];
    })
  };
}

export function buildDepartmentTreeItems(departments: readonly DeptRspDTO[]): TreeItem[] {
  return departments.flatMap((department) => {
    const item = toDepartmentTreeItem(department);
    return item ? [item] : [];
  });
}

export function DepartmentTree({
  departments,
  rootItem,
  searchQuery = '',
  selectedDepartmentId,
  onSelect
}: DepartmentTreeProps) {
  const items = React.useMemo(() => {
    const departmentItems = buildDepartmentTreeItems(departments);
    return rootItem ? [{ ...rootItem, children: departmentItems }] : departmentItems;
  }, [departments, rootItem]);
  const selection = React.useMemo(
    () =>
      ({
        mode: 'single',
        value: selectedDepartmentId,
        onValueChange: onSelect
      }) as const,
    [onSelect, selectedDepartmentId]
  );

  return (
    <Tree
      aria-label='部门树'
      items={items}
      searchQuery={searchQuery}
      selection={selection}
      emptyText='暂无部门数据'
      searchEmptyText='未找到匹配部门'
    />
  );
}
