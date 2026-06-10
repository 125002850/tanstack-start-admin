import * as React from 'react';
import * as z from 'zod';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

import { STATUS_OPTIONS } from '@/constants/enums';
import type { DictionaryTypeMutationPayload, DictionaryTypeRecord } from '../api/types';

const createSchema = z.object({
  dictTypeCode: z
    .string()
    .trim()
    .min(1, '请输入字典类型编码')
    .max(50, '编码不能超过 50 位')
    .regex(/^[a-zA-Z0-9_-]+$/, '编码只允许字母、数字、下划线和连字符'),
  dictTypeName: z.string().trim().min(1, '请输入字典类型名称').max(50, '名称不能超过 50 位')
});

const editSchema = z.object({
  dictTypeName: z.string().trim().min(1, '请输入字典类型名称').max(50, '名称不能超过 50 位'),
  status: z.string().trim().min(1, '请选择状态')
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

type DictionaryTypeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: DictionaryTypeRecord | null;
  onSubmit: (payload: DictionaryTypeMutationPayload) => Promise<void>;
};

export function DictionaryTypeSheet({
  open,
  onOpenChange,
  type,
  onSubmit
}: DictionaryTypeSheetProps) {
  const isEdit = !!type;
  const formId = 'dictionary-type-sheet-form';

  // ---- Create form ----
  const createForm = useAppForm({
    defaultValues: {
      dictTypeCode: '',
      dictTypeName: ''
    } as CreateFormValues,
    validators: { onSubmit: createSchema },
    onSubmit: async ({ value }) => {
      await onSubmit({
        id: 0,
        dictTypeCode: value.dictTypeCode,
        dictTypeName: value.dictTypeName
      });
      onOpenChange(false);
    }
  });

  const {
    FormTextField: CreateTextField
  } = useFormFields<CreateFormValues>();

  // ---- Edit form ----
  const editForm = useAppForm({
    defaultValues: {
      dictTypeName: type?.dictTypeName ?? '',
      status: type?.status ?? 'ENABLED'
    } as EditFormValues,
    validators: { onSubmit: editSchema },
    onSubmit: async ({ value }) => {
      if (!type) return;
      await onSubmit({
        id: type.id,
        dictTypeCode: type.dictTypeCode,
        dictTypeName: value.dictTypeName,
        status: value.status
      });
      onOpenChange(false);
    }
  });

  const {
    FormTextField: EditTextField,
    FormSelectField: EditSelectField
  } = useFormFields<EditFormValues>();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑字典类型' : '新增字典类型'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? '修改当前字典类型的名称和启用状态。'
              : '创建一个新的字典类型，创建后可在下方管理字典项。'}
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-auto'>
          {isEdit ? (
            <editForm.AppForm>
              <editForm.Form id={formId} className='space-y-4 px-0'>
                <div className='space-y-2 rounded-lg border bg-muted/20 px-4 py-3'>
                  <div className='text-muted-foreground text-xs tracking-[0.18em]'>
                    字典类型编码
                  </div>
                  <Input value={type?.dictTypeCode ?? ''} disabled />
                </div>

                <EditTextField
                  name='dictTypeName'
                  label='字典类型名称'
                  required
                  placeholder='例如 颜色'
                />

                <EditSelectField
                  name='status'
                  label='状态'
                  required
                  options={STATUS_OPTIONS}
                  placeholder='请选择状态'
                />
              </editForm.Form>
            </editForm.AppForm>
          ) : (
            <createForm.AppForm>
              <createForm.Form id={formId} className='space-y-4 px-0'>
                <CreateTextField
                  name='dictTypeCode'
                  label='字典类型编码'
                  required
                  placeholder='例如 color'
                />

                <CreateTextField
                  name='dictTypeName'
                  label='字典类型名称'
                  required
                  placeholder='例如 颜色'
                />
              </createForm.Form>
            </createForm.AppForm>
          )}
        </div>

        <SheetFooter className='flex-row justify-end'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type='submit' form={formId}>
            {isEdit ? '保存修改' : '创建字典类型'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}