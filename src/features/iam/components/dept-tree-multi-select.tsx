import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import type { DeptRspDTO } from '@/lib/api/clients/service';
import { cn } from '@/lib/utils';

type DeptTreeMultiSelectProps = {
  departments: readonly DeptRspDTO[];
  value: readonly string[];
  disabled?: boolean;
  onValueChange: (value: string[]) => void;
};

export function DeptTreeMultiSelect({
  departments,
  value,
  disabled = false,
  onValueChange
}: DeptTreeMultiSelectProps) {
  const selectedDeptIds = React.useMemo(() => new Set(value), [value]);

  const toggleDept = React.useCallback(
    (deptId: string, checked: boolean) => {
      const nextDeptIds = new Set(selectedDeptIds);
      if (checked) {
        nextDeptIds.add(deptId);
      } else {
        nextDeptIds.delete(deptId);
      }
      onValueChange(Array.from(nextDeptIds));
    },
    [onValueChange, selectedDeptIds]
  );

  if (departments.length === 0) {
    return (
      <div className='text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm'>
        暂无可选部门
      </div>
    );
  }

  return (
    <div
      role='tree'
      aria-label='自定义部门'
      className='flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border p-2'
    >
      {departments.map((department) => (
        <DeptTreeItem
          key={department.deptId ?? department.deptCode}
          department={department}
          depth={0}
          disabled={disabled}
          selectedDeptIds={selectedDeptIds}
          onToggle={toggleDept}
        />
      ))}
    </div>
  );
}

function DeptTreeItem({
  department,
  depth,
  disabled,
  selectedDeptIds,
  onToggle
}: {
  department: DeptRspDTO;
  depth: number;
  disabled: boolean;
  selectedDeptIds: ReadonlySet<string>;
  onToggle: (deptId: string, checked: boolean) => void;
}) {
  const deptId = department.deptId == null ? undefined : String(department.deptId);
  const label = department.deptName ?? department.deptCode ?? deptId ?? '未命名部门';
  const isDisabled = disabled || department.status === 'DISABLED' || !deptId;

  return (
    <div role='treeitem' aria-level={depth + 1} aria-disabled={isDisabled || undefined}>
      <label
        className={cn(
          'hover:bg-accent flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm',
          isDisabled && 'cursor-not-allowed opacity-50'
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <Checkbox
          checked={deptId ? selectedDeptIds.has(deptId) : false}
          disabled={isDisabled}
          aria-label={`选择 ${label}`}
          onCheckedChange={(checked) => deptId && onToggle(deptId, checked === true)}
        />
        <span>{label}</span>
        {department.status === 'DISABLED' ? (
          <span className='text-muted-foreground text-xs'>已停用</span>
        ) : null}
      </label>
      {department.children?.map((child) => (
        <DeptTreeItem
          key={child.deptId ?? child.deptCode}
          department={child}
          depth={depth + 1}
          disabled={disabled}
          selectedDeptIds={selectedDeptIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
