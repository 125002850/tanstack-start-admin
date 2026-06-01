import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { useStore } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createProductMutation, updateProductMutation } from '../api/mutations';
import type { Product } from '../api/types';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { PRODUCT_LIST_PATH } from '@/features/products/constants/product-routes';
import { useWorkspacePage } from '@/features/workspace-tabs/hooks/use-workspace-page';
import { toast } from 'sonner';
import * as React from 'react';
import * as z from 'zod';
import { productSchema, type ProductFormValues } from '@/features/products/schemas/product';
import { categoryOptions } from '@/features/products/constants/product-options';

export default function ProductForm({
  initialData,
  pageTitle
}: {
  initialData: Product | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const { updateLifecycle } = useWorkspacePage();

  const createMutation = useMutation({
    ...createProductMutation,
    onSuccess: () => {
      toast.success('产品创建成功');
      router.navigate({ to: PRODUCT_LIST_PATH });
    },
    onError: () => {
      toast.error('产品创建失败');
    }
  });

  const updateMutation = useMutation({
    ...updateProductMutation,
    onSuccess: () => {
      toast.success('产品更新成功');
      router.navigate({ to: PRODUCT_LIST_PATH });
    },
    onError: () => {
      toast.error('产品更新失败');
    }
  });

  const form = useAppForm({
    defaultValues: {
      image: undefined,
      name: initialData?.name ?? '',
      category: initialData?.category ?? '',
      price: initialData?.price,
      description: initialData?.description ?? ''
    } as ProductFormValues,
    validators: {
      onSubmit: productSchema
    },
    onSubmit: ({ value }) => {
      const payload = {
        name: value.name,
        category: value.category,
        price: value.price!,
        description: value.description
      };

      if (isEdit) {
        updateMutation.mutate({ id: initialData.id, values: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  });

  const { FormTextField, FormSelectField, FormTextareaField, FormFileUploadField } =
    useFormFields<ProductFormValues>();
  const isDefaultValue = useStore(form.store, (state) => state.isDefaultValue);

  React.useEffect(() => {
    updateLifecycle({
      title: pageTitle,
      dirty: !isDefaultValue,
      closeGuard: () => {
        if (isDefaultValue) return true;
        toast.warning('当前产品表单有未保存更改，请先保存后再关闭标签页。');
        return false;
      }
    });
  }, [isDefaultValue, pageTitle, updateLifecycle]);

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-8'>
            <FormFileUploadField
              name='image'
              label='产品图片'
              description='上传产品主图'
              maxSize={5 * 1024 * 1024}
              maxFiles={4}
            />

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <FormTextField
                name='name'
                label='产品名称'
                required
                placeholder='请输入产品名称'
                validators={{
                  onBlur: z.string().min(2, '产品名称至少需要 2 个字符。')
                }}
              />

              <FormSelectField
                name='category'
                label='产品分类'
                required
                options={categoryOptions}
                placeholder='请选择产品分类'
                validators={{
                  onBlur: z.string().min(1, '请选择产品分类。')
                }}
              />

              <FormTextField
                name='price'
                label='价格'
                required
                type='number'
                min={0}
                step={0.01}
                placeholder='请输入价格'
                validators={{
                  onBlur: z.number({ message: '请输入产品价格。' })
                }}
              />
            </div>

            <FormTextareaField
              name='description'
              label='产品描述'
              required
              placeholder='请输入产品描述'
              maxLength={500}
              rows={4}
              validators={{
                onBlur: z.string().min(10, '产品描述至少需要 10 个字符。')
              }}
            />

            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => router.navigate({ to: PRODUCT_LIST_PATH })}
              >
                返回列表
              </Button>
              <form.SubmitButton>{isEdit ? '更新产品' : '新增产品'}</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
