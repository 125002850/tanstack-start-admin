import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { changeCurrentPassword, logout } from '@/lib/api/iam/session';
import { fetchFreshIamMe } from '@/lib/api/iam/queries';
import { getRedirectParam, sanitizeInternalRedirect } from '@/lib/router/safe-redirect';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

const passwordRule = z
  .string()
  .min(8, { message: '密码至少 8 位' })
  .max(32, { message: '密码最多 32 位' })
  .regex(/[a-z]/, { message: '密码需包含小写字母' })
  .regex(/[A-Z]/, { message: '密码需包含大写字母' })
  .regex(/[0-9]/, { message: '密码需包含数字' })
  .regex(/[^A-Za-z0-9]/, { message: '密码需包含特殊字符' });

const formSchema = z
  .object({
    oldPassword: z.string().min(1, { message: '请输入旧密码' }),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, { message: '请再次输入新密码' })
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword']
  });

export default function ChangeRequiredPasswordView() {
  const router = useRouter();
  const queryClient = router.options.context.queryClient;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const redirect = sanitizeInternalRedirect(
    getRedirectParam(typeof window === 'undefined' ? '' : window.location.search),
    resolveDashboardHomeHref()
  );

  const form = useAppForm({
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);
      try {
        await changeCurrentPassword({
          oldPassword: value.oldPassword,
          newPassword: value.newPassword
        });
        await queryClient.invalidateQueries({ queryKey: ['iam'], refetchType: 'none' });
        await fetchFreshIamMe(queryClient);
        toast.success('密码已修改');
        await router.navigate({ href: redirect });
      } catch (error) {
        const message = error instanceof Error ? error.message : '修改密码失败，请稍后重试';
        setErrorMessage(message);
        toast.error(message);
      }
    }
  });

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-4 py-10'>
      <section className='flex w-full max-w-md flex-col gap-6'>
        <div className='flex flex-col gap-2 text-center'>
          <h1 className='text-2xl font-semibold tracking-tight'>首次登录需修改密码</h1>
          <p className='text-muted-foreground text-sm'>
            新密码需为 8-32 位，并包含大小写字母、数字和特殊字符。
          </p>
        </div>
        <form.AppForm>
          <form.Form className='gap-0 p-0'>
            <FieldGroup>
              <form.AppField
                name='oldPassword'
                children={(field) => (
                  <field.FieldSet>
                    <field.Field>
                      <field.FieldLabel htmlFor={field.name} required>
                        旧密码
                      </field.FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type='password'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        autoComplete='current-password'
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      />
                    </field.Field>
                    <field.FieldError />
                  </field.FieldSet>
                )}
              />
              <form.AppField
                name='newPassword'
                children={(field) => (
                  <field.FieldSet>
                    <field.Field>
                      <field.FieldLabel htmlFor={field.name} required>
                        新密码
                      </field.FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type='password'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        autoComplete='new-password'
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      />
                    </field.Field>
                    <field.FieldError />
                  </field.FieldSet>
                )}
              />
              <form.AppField
                name='confirmPassword'
                children={(field) => (
                  <field.FieldSet>
                    <field.Field>
                      <field.FieldLabel htmlFor={field.name} required>
                        确认新密码
                      </field.FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type='password'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        autoComplete='new-password'
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      />
                    </field.Field>
                    <field.FieldError />
                  </field.FieldSet>
                )}
              />
            </FieldGroup>
            <div className='flex flex-col gap-4'>
              {errorMessage && (
                <p className='text-destructive text-sm' role='alert'>
                  {errorMessage}
                </p>
              )}
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  className='flex-1'
                  onClick={() => void logout()}
                >
                  退出登录
                </Button>
                <form.SubmitButton className='flex-1'>保存新密码</form.SubmitButton>
              </div>
            </div>
          </form.Form>
        </form.AppForm>
      </section>
    </main>
  );
}
