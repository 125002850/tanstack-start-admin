import {
  useAppForm,
  useFormFields,
  FormErrors,
  scrollToFirstError
} from '@/components/ui/tanstack-form';
import { useStore } from '@tanstack/react-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type AdvancedFormValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  team: {
    name: string;
    size: number;
  };
  members: Array<{ name: string; role: string }>;
  country: string;
  state: string;
};

const countryStateMap: Record<string, { value: string; label: string }[]> = {
  us: [
    { value: 'ca', label: 'California' },
    { value: 'ny', label: 'New York' },
    { value: 'tx', label: 'Texas' }
  ],
  uk: [
    { value: 'ldn', label: 'London' },
    { value: 'mnc', label: 'Manchester' },
    { value: 'brm', label: 'Birmingham' }
  ],
  au: [
    { value: 'nsw', label: 'New South Wales' },
    { value: 'vic', label: 'Victoria' },
    { value: 'qld', label: 'Queensland' }
  ]
};

const countryOptions = [
  { value: 'us', label: '美国' },
  { value: 'uk', label: '英国' },
  { value: 'au', label: '澳大利亚' }
];

const advancedSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(1),
  team: z.object({
    name: z.string().min(2),
    size: z.number().min(1).max(100)
  }),
  members: z
    .array(
      z.object({
        name: z.string().min(1, '成员名称不能为空'),
        role: z.string().min(1, '角色不能为空')
      })
    )
    .min(1, '请至少添加一个成员'),
  country: z.string().min(1, '请选择国家'),
  state: z.string().min(1, '请选择地区')
});

export default function AdvancedFormPatterns() {
  const form = useAppForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      team: {
        name: '',
        size: 1
      },
      members: [{ name: '', role: '' }],
      country: '',
      state: ''
    } as AdvancedFormValues,
    validators: {
      onSubmit: advancedSchema
    },
    onSubmit: () => {
      toast.success('团队注册成功！');
    },
    onSubmitInvalid: () => {
      scrollToFirstError();
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<AdvancedFormValues>();

  const selectedCountry = useStore(form.store, (s) => s.values.country);
  const stateOptions = countryStateMap[selectedCountry] ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>团队注册</CardTitle>
        <p className='text-muted-foreground'>
          演示异步校验、关联字段、嵌套对象、动态数组、监听器、表单级错误以及滚动到首个错误。
        </p>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-6'>
            <FormErrors />

            {/* 账户 */}
            <div className='space-y-1'>
              <h3 className='text-lg font-semibold'>账户</h3>
              <p className='text-muted-foreground text-sm'>异步校验、关联字段</p>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormTextField
                name='username'
                label='用户名'
                required
                placeholder='请选择用户名'
                validators={{
                  onBlur: z.string().min(3, '用户名至少需要 3 个字符'),
                  onChangeAsync: async ({ value }: { value: string }) => {
                    if (!value || value.length < 3) return undefined;
                    await new Promise((r) => setTimeout(r, 500));
                    if (value === 'admin' || value === 'test') {
                      return '用户名已被占用';
                    }
                    return undefined;
                  },
                  onChangeAsyncDebounceMs: 500
                }}
              />

              <FormTextField
                name='email'
                label='邮箱'
                required
                type='email'
                placeholder='you@example.com'
                validators={{
                  onBlur: z.string().email('邮箱格式不正确')
                }}
              />

              <FormTextField
                name='password'
                label='密码'
                required
                type='password'
                placeholder='至少 8 个字符'
                validators={{
                  onBlur: z.string().min(8, '密码至少需要 8 个字符')
                }}
              />

              <form.AppField
                name='confirmPassword'
                validators={{
                  onChangeListenTo: ['password'],
                  onChange: ({ value, fieldApi }) => {
                    const password = fieldApi.form.getFieldValue('password');
                    if (value !== password) return '两次输入的密码不一致';
                    return undefined;
                  },
                  onBlur: z.string().min(1, '请确认密码')
                }}
              >
                {(field) => (
                  <field.TextField
                    label='确认密码'
                    required
                    type='password'
                    placeholder='请再次输入密码'
                  />
                )}
              </form.AppField>
            </div>

            <Separator />

            {/* 团队信息 */}
            <div className='space-y-1'>
              <h3 className='text-lg font-semibold'>团队信息</h3>
              <p className='text-muted-foreground text-sm'>
                使用点号路径的嵌套对象
              </p>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormTextField
                name='team.name'
                label='团队名称'
                required
                placeholder='例如：Alpha 团队'
                validators={{
                  onBlur: z.string().min(2, '团队名称至少需要 2 个字符')
                }}
              />
              <FormTextField
                name='team.size'
                label='团队规模'
                required
                type='number'
                min={1}
                max={100}
                placeholder='1-100'
                validators={{
                  onBlur: z.number().min(1, '至少 1 人').max(100, '最多 100 人')
                }}
              />
            </div>

            <Separator />

            {/* 成员 */}
            <div className='space-y-1'>
              <h3 className='text-lg font-semibold'>成员</h3>
              <p className='text-muted-foreground text-sm'>动态数组行，支持添加 / 删除</p>
            </div>

            <form.AppField name='members' mode='array'>
              {(field) => (
                <div className='space-y-3'>
                  {field.state.value.map((_, i) => (
                    <div key={i} className='flex items-start gap-2'>
                      <form.AppField
                        name={`members[${i}].name`}
                        validators={{
                          onBlur: z.string().min(1, '成员名称不能为空')
                        }}
                      >
                        {(subField) => (
                          <subField.FieldSet className='flex-1'>
                            <subField.Field>
                              <Input
                                placeholder='成员名称'
                                value={subField.state.value}
                                onChange={(e) => subField.handleChange(e.target.value)}
                                onBlur={subField.handleBlur}
                              />
                            </subField.Field>
                            <subField.FieldError />
                          </subField.FieldSet>
                        )}
                      </form.AppField>
                      <form.AppField
                        name={`members[${i}].role`}
                        validators={{
                          onBlur: z.string().min(1, '角色不能为空')
                        }}
                      >
                        {(subField) => (
                          <subField.FieldSet className='flex-1'>
                            <subField.Field>
                              <Input
                                placeholder='角色'
                                value={subField.state.value}
                                onChange={(e) => subField.handleChange(e.target.value)}
                                onBlur={subField.handleBlur}
                              />
                            </subField.Field>
                            <subField.FieldError />
                          </subField.FieldSet>
                        )}
                      </form.AppField>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => field.removeValue(i)}
                      >
                        <Icons.close className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => field.pushValue({ name: '', role: '' })}
                  >
                    <Icons.add className='mr-2 h-4 w-4' /> 添加成员
                  </Button>
                  {field.state.value.length > 0 && (
                    <div className='flex flex-wrap gap-1'>
                      {field.state.value
                        .filter((m) => m.name)
                        .map((m, idx) => (
                          <Badge key={idx} variant='secondary'>
                            {m.name}
                            {m.role ? ` (${m.role})` : ''}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </form.AppField>

            <Separator />

            {/* 偏好设置 */}
            <div className='space-y-1'>
              <h3 className='text-lg font-semibold'>偏好设置</h3>
              <p className='text-muted-foreground text-sm'>
                监听器副作用 —— 切换国家时重置地区
              </p>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormSelectField
                name='country'
                label='国家'
                required
                options={countryOptions}
                placeholder='请选择国家'
                validators={{
                  onBlur: z.string().min(1, '请选择国家')
                }}
                listeners={{
                  onChange: ({ fieldApi }) => {
                    fieldApi.form.setFieldValue('state', '');
                  }
                }}
              />
              <FormSelectField
                name='state'
                label='地区'
                required
                options={stateOptions}
                placeholder={selectedCountry ? '请选择地区' : '请先选择国家'}
                validators={{
                  onBlur: z.string().min(1, '请选择地区')
                }}
              />
            </div>

            <Separator />

            <div className='flex gap-4 pt-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => form.reset()}
                className='flex-1'
              >
                重置
              </Button>
              <form.SubmitButton className='flex-1'>注册团队</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
