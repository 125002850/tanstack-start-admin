import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
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
import type { DeptRspDTO, RoleRspDTO } from '@/lib/api/clients/service';
import { DATA_SCOPE_OPTIONS } from '../lib/constants';

import { DeptTreeMultiSelect } from './dept-tree-multi-select';
import { FieldShell } from './role-form-sheet';

type DataScopeType = 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT';

export function dataScopeDeptIds(
  dataScopeType: DataScopeType,
  deptIds: readonly string[]
): number[] {
  if (dataScopeType !== 'CUSTOM_DEPT') return [];
  return deptIds.map(Number).filter(Number.isFinite);
}

export default function RoleDataScopeSheet({
  open,
  onOpenChange,
  role,
  departments,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  departments: readonly DeptRspDTO[];
  onSubmit: (payload: { dataScopeType: DataScopeType; deptIds: number[] }) => Promise<void>;
}) {
  const [dataScopeType, setDataScopeType] = React.useState<DataScopeType>('SELF');
  const [deptIds, setDeptIds] = React.useState<string[]>([]);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = React.useState(false);

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

  const submit = React.useCallback(async () => {
    await onSubmit({
      dataScopeType,
      deptIds: dataScopeDeptIds(dataScopeType, deptIds)
    });
    onOpenChange(false);
  }, [dataScopeType, deptIds, onOpenChange, onSubmit]);

  return (
    <>
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
                onValueChange={(value) => setDataScopeType(value as DataScopeType)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DATA_SCOPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldShell>
            {dataScopeType === 'CUSTOM_DEPT' && (
              <FieldShell label='自定义部门'>
                <p className='text-muted-foreground text-xs'>
                  仅授权勾选的精确部门，不自动包含子部门。
                </p>
                <DeptTreeMultiSelect
                  departments={departments}
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
                if (dataScopeType === 'CUSTOM_DEPT' && deptIds.length === 0) {
                  setConfirmEmptyOpen(true);
                  return;
                }
                await submit();
              }}
            >
              保存数据权限
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmEmptyOpen} onOpenChange={setConfirmEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认保存空部门范围</AlertDialogTitle>
            <AlertDialogDescription>
              未选择部门时，该角色不会获得任何部门数据权限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>确认保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
