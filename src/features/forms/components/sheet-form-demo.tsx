import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';

type SheetFormValues = {
  name: string;
  category: string;
  priority: number | undefined;
  description: string;
};

type DialogFormValues = {
  rating: number;
  feedback: string;
};

const categoryOptions = [
  { value: 'system', label: '系统配置' },
  { value: 'workflow', label: '流程配置' },
  { value: 'notification', label: '通知配置' },
  { value: 'integration', label: '集成配置' }
];

function SheetFormSection() {
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: '',
      category: '',
      priority: undefined,
      description: ''
    } as SheetFormValues,
    onSubmit: ({ value }) => {
      toast.success('配置项创建成功！', {
        description: `${value.name} 已添加。`
      });
      setOpen(false);
    }
  });

  const { FormTextField, FormSelectField, FormTextareaField } = useFormFields<SheetFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>侧边栏表单</CardTitle>
        <CardDescription>
          配置项创建表单嵌入在侧边栏中。提交按钮位于 SheetFooter 内、 表单元素外部，通过 HTML{' '}
          <code className='bg-muted rounded px-1 text-sm'>form</code> 属性关联。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Icons.add className='mr-2 h-4 w-4' />
              新增配置项
            </Button>
          </SheetTrigger>
          <SheetContent
            autoFocusFirstField
            onAfterClose={() => form.reset()}
            className='flex flex-col'
          >
            <SheetHeader>
              <SheetTitle>新增配置项</SheetTitle>
              <SheetDescription>填写以下信息创建新配置项。</SheetDescription>
            </SheetHeader>

            <div className='flex-1 overflow-auto'>
              <form.AppForm>
                <form.Form id='sheet-form-id' className='space-y-4 p-0 md:p-0'>
                  <FormTextField
                    name='name'
                    label='配置项名称'
                    required
                    placeholder='请输入配置项名称'
                    validators={{
                      onBlur: z.string().min(2, '配置项名称至少需要 2 个字符')
                    }}
                  />

                  <FormSelectField
                    name='category'
                    label='分类'
                    required
                    options={categoryOptions}
                    placeholder='请选择分类'
                    validators={{
                      onBlur: z.string().min(1, '请选择分类')
                    }}
                  />

                  <FormTextField
                    name='priority'
                    label='优先级'
                    required
                    type='number'
                    min={1}
                    step='1'
                    placeholder='1'
                    validators={{
                      onBlur: z.number().min(1, '优先级必须大于 0')
                    }}
                  />

                  <FormTextareaField
                    name='description'
                    label='描述'
                    required
                    placeholder='请输入配置说明'
                    maxLength={500}
                    rows={4}
                    validators={{
                      onBlur: z.string().min(10, '描述至少需要 10 个字符')
                    }}
                  />
                </form.Form>
              </form.AppForm>
            </div>

            <SheetFooter className='pt-4'>
              <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type='submit' form='sheet-form-id'>
                创建配置项
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}

function DialogFormSection() {
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      rating: 5,
      feedback: ''
    } as DialogFormValues,
    onSubmit: ({ value }) => {
      toast.success('反馈已提交！', {
        description: `评分: ${value.rating}/10。感谢您的反馈！`
      });
      setOpen(false);
    }
  });

  const { FormSliderField, FormTextareaField } = useFormFields<DialogFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>对话框表单</CardTitle>
        <CardDescription>
          快速反馈表单嵌入在对话框中。使用{' '}
          <code className='bg-muted rounded px-1 text-sm'>useFormFields</code>{' '}
          的组合字段组件，提交按钮位于 DialogFooter 中。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant='outline'>
              <Icons.send className='mr-2 h-4 w-4' />
              发送反馈
            </Button>
          </DialogTrigger>
          <DialogContent onAfterClose={() => form.reset()}>
            <DialogHeader>
              <DialogTitle>快速反馈</DialogTitle>
              <DialogDescription>为您的体验评分并留下评论。</DialogDescription>
            </DialogHeader>

            <form.AppForm>
              <form.Form id='dialog-form-id' className='space-y-4 py-2'>
                <FormSliderField
                  name='rating'
                  label='评分'
                  description='为您的体验评分 (0-10)'
                  min={0}
                  max={10}
                  step={1}
                />

                <FormTextareaField
                  name='feedback'
                  label='反馈'
                  required
                  placeholder='请分享您的想法...'
                  maxLength={300}
                  rows={3}
                  validators={{
                    onBlur: z.string().min(5, '反馈至少需要 5 个字符')
                  }}
                />
              </form.Form>
            </form.AppForm>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type='submit' form='dialog-form-id'>
                提交反馈
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ToastDemoSection() {
  return (
    <Card className='md:col-span-2'>
      <CardHeader>
        <CardTitle>消息通知</CardTitle>
        <CardDescription>触发不同类型的通知消息，预览通知样式。</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-wrap gap-2'>
        <Button variant='outline' onClick={() => toast('默认通知消息')}>
          默认
        </Button>
        <Button variant='outline' onClick={() => toast.success('操作已成功完成！')}>
          <Icons.circleCheck className='mr-2 h-4 w-4' />
          成功
        </Button>
        <Button variant='outline' onClick={() => toast.error('出了点问题。')}>
          <Icons.circleX className='mr-2 h-4 w-4' />
          错误
        </Button>
        <Button variant='outline' onClick={() => toast.warning('请在继续前仔细检查。')}>
          <Icons.warning className='mr-2 h-4 w-4' />
          警告
        </Button>
        <Button variant='outline' onClick={() => toast.info('这是一条有用的信息。')}>
          <Icons.info className='mr-2 h-4 w-4' />
          信息
        </Button>
        <Button
          variant='outline'
          onClick={() =>
            toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
              loading: '加载中...',
              success: '数据加载成功！',
              error: '加载失败。'
            })
          }
        >
          <Icons.spinner className='mr-2 h-4 w-4' />
          异步
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SheetFormDemo() {
  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
      <SheetFormSection />
      <DialogFormSection />
      <ToastDemoSection />
    </div>
  );
}
