import * as React from 'react';

import { Button } from '@/components/ui/button';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { RoleRspDTO } from '@/lib/api/clients/service';
import { DATA_SCOPE_OPTIONS } from '../lib/constants';
import { deptMultiSelectOptions } from '../lib/tree';

import { FieldShell } from './role-form-sheet';

export default function RoleDataScopeSheet({
  open,
  onOpenChange,
  role,
  deptOptions,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  deptOptions: ReturnType<typeof deptMultiSelectOptions>;
  onSubmit: (payload: {
    dataScopeType: 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT';
    deptIds: number[];
  }) => Promise<void>;
}) {
  const [dataScopeType, setDataScopeType] = React.useState<'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT'>('SELF');
  const [deptIds, setDeptIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setDataScopeType(
      role?.dataScopeType === 'ALL' ||
        role?.dataScopeType === 'DEPT_AND_CHILD' ||
        role?.dataScopeType === 'DEPT_ONLY' ||
        role?.dataScopeType === 'CUSTOM_DEPT'
        ? role.dataScopeType
        : 'SELF'
    );
    setDeptIds((role?.dataScopeDeptIds ?? []).map(String));
  }, [open, role]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>数据权限</SheetTitle>
          <SheetDescription>{role?.roleName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 space-y-4'>
          <FieldShell label='数据范围'>
            <Select
              value={dataScopeType}
              onValueChange={(value) => setDataScopeType(value as 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT')}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          {dataScopeType === 'CUSTOM_DEPT' && (
            <FieldShell label='自定义部门'>
              <MultiSelectCombobox
                triggerLabel='部门'
                placeholder='选择部门'
                options={deptOptions}
                value={deptIds}
                onValueChange={setDeptIds}
              />
            </FieldShell>
          )}
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              await onSubmit({
                dataScopeType,
                deptIds: deptIds.map(Number).filter(Number.isFinite)
              });
              onOpenChange(false);
            }}
          >
            保存数据权限
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
