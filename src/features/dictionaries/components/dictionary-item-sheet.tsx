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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

import { STATUS_OPTIONS } from '@/constants/enums';
import type { DictionaryItemMutationPayload, DictionaryItemRecord } from '../api/types';

const dictionaryItemSchema = z.object({
  dictItemCode: z.string().trim().min(1, '请输入字典项编码'),
  dictItemName: z.string().trim().min(1, '请输入字典项名称'),
  status: z.string().trim().min(1, '请选择状态'),
  sort: z.union([z.literal(''), z.number().int().min(0, '排序不能小于 0')]),
  remark: z.string().max(200, '备注不能超过 200 字').optional()
});

type DictionaryItemFormValues = z.infer<typeof dictionaryItemSchema>;

type DictionaryItemSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictTypeCode: string;
  item?: DictionaryItemRecord | null;
  onSubmit: (payload: DictionaryItemMutationPayload) => Promise<void>;
  onDelete?: (item: DictionaryItemRecord) => void;
};

export function DictionaryItemSheet({
  open,
  onOpenChange,
  dictTypeCode,
  item,
  onSubmit,
  onDelete
}: DictionaryItemSheetProps) {
  const isEdit = !!item;
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const form = useAppForm({
    defaultValues: {
      dictItemCode: item?.dictItemCode ?? '',
      dictItemName: item?.dictItemName ?? '',
      status: item?.status ?? 'ENABLED',
      sort: item?.sort ?? '',
      remark: item?.remark ?? ''
    } as DictionaryItemFormValues,
    validators: {
      onSubmit: dictionaryItemSchema
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        id: item?.id,
        dictTypeCode,
        dictItemCode: value.dictItemCode,
        dictItemName: value.dictItemName,
        status: value.status,
        sort: value.sort === '' ? undefined : value.sort,
        remark: value.remark?.trim() || undefined
      });
      onOpenChange(false);
    }
  });

  const { FormSelectField, FormTextField, FormTextareaField } =
    useFormFields<DictionaryItemFormValues>();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑字典项' : '新增字典项'}</SheetTitle>
          <SheetDescription>
            {isEdit ? '修改当前字典项的业务属性。' : '为当前字典类型补充新的字典项。'}
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='dictionary-item-sheet-form' className='space-y-4 px-0'>
              <FormTextField
                name='dictItemCode'
                label='字典项编码'
                required
                placeholder='例如 red'
              />

              <FormTextField
                name='dictItemName'
                label='字典项名称'
                required
                placeholder='例如 红色'
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormSelectField
                  name='status'
                  label='状态'
                  required
                  options={STATUS_OPTIONS}
                  placeholder='请选择状态'
                />

                <FormTextField
                  name='sort'
                  label='排序'
                  type='number'
                  min={0}
                  placeholder='例如 10'
                />
              </div>

              <FormTextareaField
                name='remark'
                label='备注'
                placeholder='补充这条字典项的使用说明'
                rows={4}
                maxLength={200}
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter className='flex-row justify-end gap-2'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {isEdit && onDelete && (
            <Button type='button' variant='destructive' onClick={() => setDeleteDialogOpen(true)}>
              删除
            </Button>
          )}
          <Button type='submit' form='dictionary-item-sheet-form'>
            {isEdit ? '保存修改' : '新增字典项'}
          </Button>
        </SheetFooter>
      </SheetContent>

      {isEdit && item && onDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除字典项「{item.dictItemName}」吗？删除后不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(item);
                  onOpenChange(false);
                }}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Sheet>
  );
}
