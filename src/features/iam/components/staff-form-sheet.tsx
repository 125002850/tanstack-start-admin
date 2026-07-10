import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import type {
  RoleRspDTO,
  StaffCreateReqDTO,
  StaffRspDTO,
  StaffUpdateReqDTO
} from '@/lib/api/clients/service';
import { SUPER_ADMIN_ROLE_CODE } from '@/lib/api/iam/permissions';
import { ENABLE_STATUS_OPTIONS } from '../lib/constants';
import { deptSelectOptions } from '../lib/tree';

type StaffFormValues = {
  username: string;
  staffCode: string;
  staffName: string;
  deptId: string;
  password: string;
  phone: string;
  email: string;
  status: 'ENABLED' | 'DISABLED';
  roleIds: string[];
  remark: string;
};

const emptyStaffFormValues: StaffFormValues = {
  username: '',
  staffCode: '',
  staffName: '',
  deptId: '',
  password: '',
  phone: '',
  email: '',
  status: 'ENABLED',
  roleIds: [],
  remark: ''
};

export function roleOptions(roles: readonly RoleRspDTO[] = []) {
  return roles
    .filter((role) => role.roleId != null && role.roleCode !== SUPER_ADMIN_ROLE_CODE)
    .map((role) => ({
      value: String(role.roleId),
      label: `${role.roleName ?? role.roleCode ?? role.roleId}`,
      disabled: role.status === 'DISABLED'
    }));
}

export function selectedRoleIds(staff?: StaffRspDTO | null) {
  return (staff?.roles ?? [])
    .filter((role) => role.roleCode !== SUPER_ADMIN_ROLE_CODE)
    .map((role) => role.roleId)
    .filter((roleId): roleId is number => typeof roleId === 'number')
    .map(String);
}

export function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StaffFormSheet({
  open,
  onOpenChange,
  staff,
  departments,
  roles,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
  departments: ReturnType<typeof deptSelectOptions>;
  roles: ReturnType<typeof roleOptions>;
  onSubmit: (payload: StaffCreateReqDTO | StaffUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!staff?.staffId;
  const [values, setValues] = React.useState<StaffFormValues>(emptyStaffFormValues);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      username: staff?.username ?? '',
      staffCode: staff?.staffCode ?? '',
      staffName: staff?.staffName ?? '',
      deptId: staff?.deptId == null ? '' : String(staff.deptId),
      password: '',
      phone: staff?.phone ?? '',
      email: staff?.email ?? '',
      status: staff?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      roleIds: isEdit ? selectedRoleIds(staff) : [],
      remark: staff?.remark ?? ''
    });
  }, [isEdit, open, staff]);

  const update = React.useCallback(
    (patch: Partial<StaffFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const deptId = Number(values.deptId);
      if (!values.staffCode.trim() || !values.staffName.trim() || !Number.isFinite(deptId)) {
        toast.error('请填写工号、姓名和部门');
        return;
      }
      if (!isEdit && (!values.username.trim() || !values.password.trim())) {
        toast.error('请填写用户名和初始密码');
        return;
      }

      if (isEdit) {
        if (!staff?.staffId) return;
        await onSubmit({
          staffId: staff.staffId,
          staffCode: values.staffCode.trim(),
          staffName: values.staffName.trim(),
          deptId,
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          status: values.status,
          remark: values.remark.trim() || undefined
        });
      } else {
        await onSubmit({
          username: values.username.trim(),
          staffCode: values.staffCode.trim(),
          staffName: values.staffName.trim(),
          deptId,
          password: values.password,
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          status: values.status,
          roleIds: values.roleIds.map(Number).filter(Number.isFinite),
          remark: values.remark.trim() || undefined
        });
      }
      onOpenChange(false);
    },
    [isEdit, onOpenChange, onSubmit, staff?.staffId, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑员工' : '新增员工'}</SheetTitle>
          <SheetDescription>
            {isEdit ? '修改员工基础资料和启用状态。' : '创建本地 IAM 员工账号。'}
          </SheetDescription>
        </SheetHeader>
        <form id='staff-form' className='min-h-0 flex-1 space-y-4 overflow-auto' onSubmit={handleSubmit}>
          {!isEdit && (
            <FieldShell label='用户名'>
              <Input value={values.username} onChange={(event) => update({ username: event.target.value })} />
            </FieldShell>
          )}
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='员工工号'>
              <Input value={values.staffCode} onChange={(event) => update({ staffCode: event.target.value })} />
            </FieldShell>
            <FieldShell label='员工姓名'>
              <Input value={values.staffName} onChange={(event) => update({ staffName: event.target.value })} />
            </FieldShell>
          </div>
          <FieldShell label='部门'>
            <Select value={values.deptId} onValueChange={(deptId) => update({ deptId })}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='选择部门' />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.value} value={department.value} disabled={department.disabled}>
                    {department.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='手机号'>
              <Input value={values.phone} onChange={(event) => update({ phone: event.target.value })} />
            </FieldShell>
            <FieldShell label='邮箱'>
              <Input value={values.email} onChange={(event) => update({ email: event.target.value })} />
            </FieldShell>
          </div>
          {!isEdit && (
            <>
              <FieldShell label='初始密码'>
                <Input
                  type='password'
                  value={values.password}
                  onChange={(event) => update({ password: event.target.value })}
                />
              </FieldShell>
              <FieldShell label='初始角色'>
                <MultiSelectCombobox
                  triggerLabel='角色'
                  placeholder='选择角色'
                  options={roles}
                  value={values.roleIds}
                  onValueChange={(roleIds) => update({ roleIds })}
                />
              </FieldShell>
            </>
          )}
          <FieldShell label='状态'>
            <Select value={values.status} onValueChange={(status) => update({ status: status as StaffFormValues['status'] })}>
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
          <FieldShell label='备注'>
            <Textarea value={values.remark} onChange={(event) => update({ remark: event.target.value })} />
          </FieldShell>
        </form>
        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form='staff-form'>
            {isEdit ? '保存修改' : '创建员工'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default StaffFormSheet;
