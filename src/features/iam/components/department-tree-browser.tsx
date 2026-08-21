import * as React from 'react';

import { Icons } from '@/components/icons';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group';
import { Tree, type TreeItem } from '@/components/ui/tree';
import type { DeptRspDTO } from '@/lib/api/clients/service';

const ALL_DEPARTMENTS_VALUE = 'all';

interface DepartmentTreeBrowserProps {
  departments: readonly DeptRspDTO[];
  value: number | null;
  onValueChange: (value: number | null) => void;
  isLoading?: boolean;
  isError?: boolean;
}

function departmentTreeItem(department: DeptRspDTO): TreeItem | null {
  if (department.deptId == null) return null;
  const fallbackLabel = department.deptCode ?? String(department.deptId);
  return {
    value: String(department.deptId),
    label: department.deptName ?? fallbackLabel,
    searchText: [department.deptName, department.deptCode, department.fullPath]
      .filter(Boolean)
      .join(' '),
    icon: Icons.department,
    children: (department.children ?? []).flatMap((child) => {
      const item = departmentTreeItem(child);
      return item ? [item] : [];
    })
  };
}

export function buildDepartmentBrowserItems(departments: readonly DeptRspDTO[]): TreeItem[] {
  return [
    {
      value: ALL_DEPARTMENTS_VALUE,
      label: '全部员工',
      searchText: '全部员工 全部部门',
      icon: Icons.teams,
      children: departments.flatMap((department) => {
        const item = departmentTreeItem(department);
        return item ? [item] : [];
      })
    }
  ];
}

export function DepartmentTreeBrowser({
  departments,
  value,
  onValueChange,
  isLoading = false,
  isError = false
}: DepartmentTreeBrowserProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const items = React.useMemo(() => buildDepartmentBrowserItems(departments), [departments]);
  const selectedValue = value == null ? ALL_DEPARTMENTS_VALUE : String(value);

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <InputGroup className='h-8 shadow-none'>
        <InputGroupAddon aria-hidden='true'>
          <Icons.search className='size-4' />
        </InputGroupAddon>
        <InputGroupInput
          value={searchQuery}
          aria-label='搜索部门'
          placeholder='搜索部门'
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {searchQuery ? (
          <InputGroupAddon align='inline-end'>
            <InputGroupButton
              size='icon-xs'
              aria-label='清空部门搜索'
              onClick={() => setSearchQuery('')}
            >
              <Icons.close className='size-3.5' />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <div className='min-h-0 flex-1 overflow-auto pr-1'>
        {isLoading && departments.length === 0 ? (
          <div
            className='flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground'
            role='status'
          >
            <Icons.spinner className='size-4 animate-spin' />
            正在加载组织架构
          </div>
        ) : isError && departments.length === 0 ? (
          <div className='px-2 py-6 text-sm text-destructive' role='alert'>
            组织架构加载失败，请刷新重试
          </div>
        ) : (
          <Tree
            items={items}
            searchQuery={deferredSearchQuery}
            searchEmptyText='未找到匹配部门'
            selection={{
              mode: 'single',
              value: selectedValue,
              onValueChange: (nextValue) => {
                onValueChange(
                  nextValue === ALL_DEPARTMENTS_VALUE ? null : Number.parseInt(nextValue, 10)
                );
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
