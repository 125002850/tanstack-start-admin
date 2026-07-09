import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldItem, FieldLabel as DetailFieldLabel } from '@/components/ui/detail-field';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { changeCurrentPassword } from '@/lib/api/iam/session';
import { cn } from '@/lib/utils';
import { dataScopeLabel } from '../lib/format';

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 32 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function AccountProfileDetails({ className }: { className?: string }) {
  const { data: me } = useQuery(getIamMeQueryOptions());
  const staff = me?.staff;
  const dataScope = me?.dataScopeSummary ?? me?.dataScope;

  return (
    <div className={cn('grid gap-6 lg:grid-cols-[1.2fr_0.8fr]', className)}>
      <div className='grid gap-3 sm:grid-cols-2'>
        <FieldItem label='员工ID' value={staff?.staffId} />
        <FieldItem label='用户名' value={staff?.username} />
        <FieldItem label='员工工号' value={staff?.staffCode} />
        <FieldItem label='员工姓名' value={staff?.staffName} />
        <FieldItem label='部门' value={staff?.deptName ?? me?.dept?.deptName} />
        <FieldItem label='手机号' value={staff?.phone} />
        <FieldItem label='邮箱' value={staff?.email} />
        <FieldItem label='状态' value={staff?.status} />
      </div>
      <div className='flex flex-col gap-6'>
        <div className='flex flex-col gap-2'>
          <DetailFieldLabel>角色</DetailFieldLabel>
          <div className='flex flex-wrap gap-1.5'>
            {(me?.roles ?? []).length > 0 ? (
              me!.roles.map((role) => (
                <Badge key={role.roleId ?? role.roleCode} variant='outline'>
                  {role.roleName ?? role.roleCode}
                </Badge>
              ))
            ) : (
              <span className='text-muted-foreground text-sm'>未分配角色</span>
            )}
          </div>
        </div>
        <div className='grid gap-3'>
          <FieldItem label='数据范围' value={dataScopeLabel(dataScope?.effectiveType)} />
          <FieldItem label='数据权限说明' value={dataScope?.description} valueMaxLines={2} />
          <FieldItem
            label='可访问部门'
            value={dataScope?.deptNames?.join(', ')}
            valueMaxLines={2}
          />
        </div>
      </div>
    </div>
  );
}

export function AccountProfilePage() {
  return (
    <Card>
      <CardContent>
        <AccountProfileDetails />
      </CardContent>
    </Card>
  );
}

export function AccountPasswordForm({
  className,
  onCancel,
  onSuccess
}: {
  className?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const oldPasswordId = React.useId();
  const newPasswordId = React.useId();
  const confirmPasswordId = React.useId();
  const mutation = useMutation({
    mutationFn: () => changeCurrentPassword({ oldPassword, newPassword }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getIamMeQueryOptions().queryKey });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('密码已修改');
      onSuccess?.();
    }
  });

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!oldPassword || !newPassword) {
        toast.error('请输入旧密码和新密码');
        return;
      }
      if (!isStrongPassword(newPassword)) {
        toast.error('新密码需 8-32 位，并包含大小写字母、数字和特殊字符');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('两次输入的新密码不一致');
        return;
      }
      mutation.mutate();
    },
    [confirmPassword, mutation, newPassword, oldPassword]
  );

  return (
    <form className={cn('flex flex-col gap-4', className)} onSubmit={handleSubmit}>
      <FieldGroup className='gap-4'>
        <Field>
          <FieldLabel htmlFor={oldPasswordId}>旧密码</FieldLabel>
          <Input
            id={oldPasswordId}
            type='password'
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            autoComplete='current-password'
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={newPasswordId}>新密码</FieldLabel>
          <Input
            id={newPasswordId}
            type='password'
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete='new-password'
          />
          <FieldDescription>需 8-32 位，并包含大小写字母、数字和特殊字符。</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={confirmPasswordId}>确认新密码</FieldLabel>
          <Input
            id={confirmPasswordId}
            type='password'
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete='new-password'
          />
        </Field>
      </FieldGroup>
      <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type='submit' disabled={mutation.isPending}>
          保存密码
        </Button>
      </div>
    </form>
  );
}

export function AccountPasswordPage() {
  return (
    <Card>
      <CardContent>
        <AccountPasswordForm className='max-w-xl' />
      </CardContent>
    </Card>
  );
}
