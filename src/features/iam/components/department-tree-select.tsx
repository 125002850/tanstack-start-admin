import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { TreeItem } from '@/components/ui/tree';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import type { DeptRspDTO } from '@/lib/api/clients/service';
import { cn } from '@/lib/utils';

import { DepartmentTree } from './department-tree';

interface DepartmentTreeSelectProps {
  readonly departments: readonly DeptRspDTO[];
  readonly disabled?: boolean;
  readonly excludedDepartmentId?: number;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly rootItem?: Omit<TreeItem, 'children'>;
  readonly triggerLabel: string;
  readonly value?: string;
}

function excludeDepartmentBranch(
  departments: readonly DeptRspDTO[],
  excludedDepartmentId: number | undefined
): DeptRspDTO[] {
  if (excludedDepartmentId == null) return [...departments];

  return departments.flatMap((department) => {
    if (department.deptId === excludedDepartmentId) return [];
    return [
      {
        ...department,
        children: excludeDepartmentBranch(department.children ?? [], excludedDepartmentId)
      }
    ];
  });
}

function findDepartmentLabel(
  departments: readonly DeptRspDTO[],
  value: string | undefined
): string | undefined {
  if (!value) return undefined;

  for (const department of departments) {
    if (department.deptId != null && String(department.deptId) === value) {
      return department.deptName ?? department.deptCode ?? value;
    }
    const childLabel = findDepartmentLabel(department.children ?? [], value);
    if (childLabel) return childLabel;
  }
  return undefined;
}

export function DepartmentTreeSelect({
  departments,
  disabled = false,
  excludedDepartmentId,
  onValueChange,
  placeholder = '选择部门',
  rootItem,
  triggerLabel,
  value
}: DepartmentTreeSelectProps) {
  const contentId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const selectableDepartments = React.useMemo(
    () => excludeDepartmentBranch(departments, excludedDepartmentId),
    [departments, excludedDepartmentId]
  );
  const selectedLabel =
    rootItem && rootItem.value === value
      ? rootItem.label
      : findDepartmentLabel(selectableDepartments, value);
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearchQuery('');
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={setTriggerNode}
          aria-controls={contentId}
          aria-expanded={open}
          aria-label={triggerLabel}
          disabled={disabled}
          role='combobox'
          type='button'
          variant='outline'
          className={cn(
            'w-full min-w-0 justify-between gap-2 bg-transparent font-normal',
            !selectedLabel && 'text-muted-foreground'
          )}
        >
          <span className='min-w-0 flex-1 truncate text-left'>{selectedLabel ?? placeholder}</span>
          <Icons.chevronsUpDown className='size-4 shrink-0 opacity-50' aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={contentId}
        align='start'
        className='w-(--radix-popover-trigger-width) min-w-72 p-0'
        container={open ? (container ?? getContainer()) : container}
        finalFocus={triggerRef}
      >
        <div className='flex flex-col gap-2 p-2'>
          <InputGroup>
            <InputGroupAddon>
              <Icons.search className='size-4' aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              aria-label='搜索部门'
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder='搜索部门'
              type='search'
              value={searchQuery}
            />
          </InputGroup>
          <div className='max-h-[18.75rem] min-w-0 overflow-x-hidden overflow-y-auto'>
            <DepartmentTree
              departments={selectableDepartments}
              onSelect={(departmentId) => {
                onValueChange(departmentId);
                setOpen(false);
              }}
              rootItem={rootItem}
              searchQuery={searchQuery}
              selectedDepartmentId={value ?? null}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
