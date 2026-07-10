import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import type {
  RoleCreateReqDTO,
  RoleRspDTO,
  RoleUpdateReqDTO
} from '@/lib/api/clients/service';
import { DATA_SCOPE_OPTIONS, ENABLE_STATUS_OPTIONS } from '../lib/constants';

type RoleFormValues = {
  roleCode: string;
  roleName: string;
  sortOrder: string;
  status: 'ENABLED' | 'DISABLED';
  dataScopeType: 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT';
  remark: string;
};

const emptyRoleValues: RoleFormValues = {
  roleCode: '',
  roleName: '',
  sortOrder: '10',
  status: 'ENABLED',
  dataScopeType: 'SELF',
  remark: ''
};

export function isProtectedRole(role: RoleRspDTO | null | undefined) {
  return role?.systemBuiltIn || role?.roleCode === 'SUPER_ADMIN';
}

export function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function RoleFormSheet({
  open,
  onOpenChange,
  role,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  onSubmit: (payload: RoleCreateReqDTO | RoleUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!role?.roleId;
  const [values, setValues] = React.useState<RoleFormValues>(emptyRoleValues);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      roleCode: role?.roleCode ?? '',
      roleName: role?.roleName ?? '',
      sortOrder: String(role?.sortOrder ?? 10),
      status: role?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      dataScopeType:
        role?.dataScopeType === 'ALL' ||
        role?.dataScopeType === 'DEPT_AND_CHILD' ||
        role?.dataScopeType === 'DEPT_ONLY' ||
        role?.dataScopeType === 'CUSTOM_DEPT'
          ? role.dataScopeType
          : 'SELF',
      remark: role?.remark ?? ''
    });
  }, [open, role]);

  const update = React.useCallback(
    (patch: Partial<RoleFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!values.roleCode.trim() || !values.roleName.trim()) {
        toast.error('请填写角色编码和名称');
        return;
      }
      const sortOrder = Number(values.sortOrder);
      const payload = {
        roleCode: values.roleCode.trim(),
        roleName: values.roleName.trim(),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        status: values.status,
        dataScopeType: values.dataScopeType,
        remark: values.remark.trim() || undefined
      };
      if (isEdit) {
        if (!role?.roleId) return;
        await onSubmit({ ...payload, roleId: role.roleId });
      } else {
        await onSubmit(payload);
      }
      onOpenChange(false);
    },
    [isEdit, onOpenChange, onSubmit, role?.roleId, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑角色' : '新增角色'}</SheetTitle>
          <SheetDescription>{isEdit ? '修改角色基础信息。' : '创建业务角色。'}</SheetDescription>
        </SheetHeader>
        <form
          id='role-form'
          className='min-h-0 flex-1 space-y-4 overflow-auto'
          onSubmit={handleSubmit}
        >
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='角色编码'>
              <Input
                value={values.roleCode}
                disabled={isProtectedRole(role)}
                onChange={(event) => update({ roleCode: event.target.value })}
              />
            </FieldShell>
            <FieldShell label='角色名称'>
              <Input
                value={values.roleName}
                onChange={(event) => update({ roleName: event.target.value })}
              />
            </FieldShell>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='排序'>
              <Input
                inputMode='numeric'
                value={values.sortOrder}
                onChange={(event) => update({ sortOrder: event.target.value })}
              />
            </FieldShell>
            <FieldShell label='状态'>
              <Select
                value={values.status}
                onValueChange={(status) => update({ status: status as RoleFormValues['status'] })}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENABLE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          </div>
          <FieldShell label='数据范围'>
            <Select
              value={values.dataScopeType}
              onValueChange={(dataScopeType) =>
                update({ dataScopeType: dataScopeType as RoleFormValues['dataScopeType'] })
              }
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
          <FieldShell label='备注'>
            <Textarea
              value={values.remark}
              onChange={(event) => update({ remark: event.target.value })}
            />
          </FieldShell>
        </form>
        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form='role-form'>
            {isEdit ? '保存修改' : '创建角色'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
