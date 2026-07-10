import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import * as z from 'zod';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { loginWithPassword } from '@/lib/api/iam/session';
import { getRedirectParam, sanitizeInternalRedirect } from '@/lib/router/safe-redirect';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

const formSchema = z.object({
  username: z.string().trim().min(1, { message: '请输入用户名' }),
  password: z.string().min(1, { message: '请输入密码' })
});

export default function UserAuthForm() {
  const router = useRouter();
  const queryClient = router.options.context.queryClient;
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirect = sanitizeInternalRedirect(
    getRedirectParam(typeof window === 'undefined' ? '' : window.location.search),
    resolveDashboardHomeHref()
  );

  const form = useAppForm({
    defaultValues: {
      username: '',
      password: ''
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);
      try {
        const result = await loginWithPassword({
          username: value.username.trim(),
          password: value.password
        });

        if (result.mustChangePassword) {
          await router.navigate({
            to: '/auth/password/change-required',
            search: { redirect }
          });
          return;
        }

        await queryClient.ensureQueryData(getIamMeQueryOptions());
        await router.navigate({ href: redirect });
      } catch (error) {
        const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
        setErrorMessage(message);
        toast.error(message);
      }
    }
  });

  return (
    <form.AppForm>
      <form.Form className='w-full gap-0 p-0'>
        <FieldGroup>
          <form.AppField
            name='username'
            children={(field) => (
              <field.FieldSet>
                <field.Field>
                  <field.FieldLabel htmlFor={field.name} required>
                    用户名
                  </field.FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    autoComplete='username'
                    placeholder='请输入用户名'
                    aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  />
                </field.Field>
                <field.FieldError />
              </field.FieldSet>
            )}
          />
          <form.AppField
            name='password'
            children={(field) => (
              <field.FieldSet>
                <field.Field>
                  <field.FieldLabel htmlFor={field.name} required>
                    密码
                  </field.FieldLabel>
                  <div className='flex gap-2'>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      autoComplete='current-password'
                      placeholder='请输入密码'
                      type={showPassword ? 'text' : 'password'}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    />
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? (
                        <Icons.eyeOff className='size-4' aria-hidden={true} />
                      ) : (
                        <Icons.eye className='size-4' aria-hidden={true} />
                      )}
                    </Button>
                  </div>
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
          <form.SubmitButton className='w-full'>登录</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  );
}
