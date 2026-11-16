import { useId, useState } from 'react';
import { useStore } from '@tanstack/react-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { revalidateLogic, useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { changeCurrentStaffPassword } from '@/lib/api/clients/service';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { SessionExpiredError } from '@/lib/api/sso/session-expiry';

const requiredPassword = (message: string) =>
  z.string().refine((value) => value.trim().length > 0, message);

const passwordSchema = z
  .object({
    oldPassword: requiredPassword('请输入当前密码'),
    newPassword: requiredPassword('请输入新密码'),
    repeatPassword: requiredPassword('请再次输入新密码')
  })
  .refine((value) => !value.newPassword || value.newPassword === value.repeatPassword, {
    path: ['repeatPassword'],
    message: '两次输入的新密码不一致'
  })
  .refine((value) => !value.newPassword || value.newPassword !== value.oldPassword, {
    path: ['newPassword'],
    message: '新密码不能与当前密码相同'
  });

type PasswordValues = z.infer<typeof passwordSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  onCloseAutoFocus
}: ChangePasswordDialogProps) {
  const id = useId();
  const [visiblePasswords, setVisiblePasswords] = useState<
    Partial<Record<keyof PasswordValues, boolean>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      repeatPassword: ''
    } satisfies PasswordValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onSubmit: passwordSchema, onDynamic: passwordSchema },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        // 直接调用 generated client，避免密码作为 mutation variables 留在 Query 缓存中。
        await changeCurrentStaffPassword(value);
        toast.success('密码修改成功');
        onOpenChange(false);
      } catch (error) {
        // 401 由共享 transport 和全局会话弹框处理。
        if (!(error instanceof SessionExpiredError)) {
          setSubmitError(normalizeApiError(error).message);
        }
      }
    }
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const { FormTextField } = useFormFields<PasswordValues>();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!form.state.isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md'
        onCloseAutoFocus={onCloseAutoFocus}
        onAfterClose={() => {
          form.reset();
          setVisiblePasswords({});
          setSubmitError(null);
        }}
      >
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>修改当前账号的SSO统一登录密码。</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form id={id} className='p-0 md:p-0'>
            <FieldGroup>
              {(
                [
                  ['oldPassword', '当前密码', 'current-password'],
                  ['newPassword', '新密码', 'new-password'],
                  ['repeatPassword', '确认新密码', 'new-password']
                ] as const
              ).map(([name, label, autoComplete]) => {
                const visible = Boolean(visiblePasswords[name]);
                const VisibilityIcon = visible ? Icons.eyeOff : Icons.eye;
                return (
                  <FormTextField
                    key={name}
                    name={name}
                    label={label}
                    type={visible ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    disabled={isSubmitting}
                    required
                    validators={
                      name === 'repeatPassword'
                        ? {
                            onChangeListenTo: ['newPassword'],
                            onChange: ({ value }: { value: string }) =>
                              value && value !== form.getFieldValue('newPassword')
                                ? '两次输入的新密码不一致'
                                : undefined
                          }
                        : undefined
                    }
                    endAdornment={
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='text-muted-foreground size-7'
                        aria-label={`${visible ? '隐藏' : '显示'}${label}`}
                        aria-controls={name}
                        disabled={isSubmitting}
                        onClick={() =>
                          setVisiblePasswords((current) => ({ ...current, [name]: !current[name] }))
                        }
                      >
                        <VisibilityIcon className='size-4' aria-hidden='true' />
                      </Button>
                    }
                  />
                );
              })}
            </FieldGroup>
            {submitError && (
              <Alert variant='destructive'>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </form.Form>
          <DialogFooter>
            <Button variant='outline' disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <form.SubmitButton form={id}>修改密码</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
