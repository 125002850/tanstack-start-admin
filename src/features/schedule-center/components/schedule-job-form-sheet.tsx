import { useDict, dictionaryOptionsWithCodeFallback } from '@/hooks/use-dict';
import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as z from 'zod';
import type { ApiClientError } from '@oig/react-query-generator/core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import {
  type ScheduleJobRspDTO,
  type ScheduleJobCreateReqDTOStatus,
  systemScheduleJobCreateMutationOptions,
  type SystemScheduleJobCreateRequest,
  type SystemScheduleJobCreateResponse,
  systemScheduleJobUpdateMutationOptions,
  type SystemScheduleJobUpdateRequest,
  type SystemScheduleJobUpdateResponse
} from '@/lib/api/clients/service';
import { emptyStringToUndefined } from '@/lib/api/request-values';
import { ScheduleJobCronPreviewPopover } from './schedule-job-cron-preview-popover';

const CRON_FIELD_PATTERN = /^[\dA-Z*?\-/,]+$/i;
const SCHEDULE_JOB_CREATE_STATUS = {
  ENABLE: 'enable',
  DISABLE: 'disable'
} as const;

function isValidCronField(field: string): boolean {
  return CRON_FIELD_PATTERN.test(field);
}

function validateCronExpression(
  value: string | undefined,
  ctx: z.RefinementCtx,
  fieldName: string
) {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${fieldName}：Cron 表达式需要 6 个字段（例如 "0 0/5 * * * ?"）`,
      path: fieldName === '默认 Cron' ? ['defaultCron'] : ['cronExpression']
    });
    return;
  }
  for (const field of fields) {
    if (!isValidCronField(field)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName}：字段 "${field}" 包含无效字符`,
        path: fieldName === '默认 Cron' ? ['defaultCron'] : ['cronExpression']
      });
      return;
    }
  }
}

const cronFieldSchema = z.string().trim().optional().or(z.literal(''));

const createSchema = z
  .object({
    jobName: z.string().trim().min(1, '请输入任务名称').max(128, '名称不能超过 128 位'),
    jobCode: z.string().trim().min(1, '请输入任务编码').max(64, '编码不能超过 64 位'),
    defaultCron: cronFieldSchema,
    cronExpression: cronFieldSchema,
    invokeRoute: z.string().trim().min(1, '请输入调用路由').max(512, '调用路由不能超过 512 个字符'),
    groupName: z.string().trim().optional().or(z.literal('')),
    status: z.string().optional(),
    remark: z.string().trim().optional().or(z.literal(''))
  })
  .superRefine((data, ctx) => {
    validateCronExpression(data.defaultCron, ctx, '默认 Cron');
    validateCronExpression(data.cronExpression, ctx, '当前 Cron');
  });

const editSchema = z
  .object({
    jobName: z.string().trim().min(1, '请输入任务名称').max(128, '名称不能超过 128 位'),
    jobCode: z.string().trim().min(1, '请输入任务编码').max(64, '编码不能超过 64 位'),
    defaultCron: cronFieldSchema,
    cronExpression: cronFieldSchema,
    invokeRoute: z.string().trim().min(1, '请输入调用路由').max(512, '调用路由不能超过 512 个字符'),
    groupName: z.string().trim().optional().or(z.literal('')),
    remark: z.string().trim().optional().or(z.literal(''))
  })
  .superRefine((data, ctx) => {
    validateCronExpression(data.defaultCron, ctx, '默认 Cron');
    validateCronExpression(data.cronExpression, ctx, '当前 Cron');
  });

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

interface ScheduleJobFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord: ScheduleJobRecord | null;
}

type ScheduleJobRecord = ScheduleJobRspDTO;

function toCreateRequest(value: CreateFormValues): SystemScheduleJobCreateRequest {
  return {
    jobName: value.jobName.trim(),
    jobCode: value.jobCode.trim(),
    defaultCron: emptyStringToUndefined(value.defaultCron?.trim()),
    cronExpression: emptyStringToUndefined(value.cronExpression?.trim()),
    invokeRoute: value.invokeRoute.trim(),
    groupName: emptyStringToUndefined(value.groupName?.trim()),
    status: (value.status || SCHEDULE_JOB_CREATE_STATUS.DISABLE) as ScheduleJobCreateReqDTOStatus,
    remark: emptyStringToUndefined(value.remark?.trim())
  };
}

function toUpdateRequest(value: EditFormValues, id: number): SystemScheduleJobUpdateRequest {
  return {
    id,
    jobName: value.jobName.trim(),
    jobCode: value.jobCode.trim(),
    defaultCron: value.defaultCron?.trim() ?? '',
    cronExpression: value.cronExpression?.trim() ?? '',
    invokeRoute: value.invokeRoute?.trim() ?? '',
    groupName: value.groupName?.trim() ?? '',
    remark: value.remark?.trim() ?? ''
  };
}

export function ScheduleJobFormSheet({
  open,
  onOpenChange,
  editingRecord
}: ScheduleJobFormSheetProps) {
  const statusDictionary = useDict('ENABLE_STATUS');
  const statusOptions = dictionaryOptionsWithCodeFallback(statusDictionary.options, [
    'enable',
    'disable'
  ]);
  const isEdit = !!editingRecord;
  const formId = 'schedule-job-form';

  const createMutationOpts = systemScheduleJobCreateMutationOptions();
  const createMutation = useMutation<
    SystemScheduleJobCreateResponse,
    ApiClientError,
    SystemScheduleJobCreateRequest
  >({
    ...createMutationOpts,
    onSuccess: (...args) => {
      toast.success('任务已创建');
      return createMutationOpts.onSuccess?.(...args);
    },
    onError: (error) =>
      toast.error(
        normalizeApiError(error, { fallbackMessage: '任务创建失败，请稍后重试。' }).message
      )
  });

  const updateMutationOpts = systemScheduleJobUpdateMutationOptions();
  const updateMutation = useMutation<
    SystemScheduleJobUpdateResponse,
    ApiClientError,
    SystemScheduleJobUpdateRequest
  >({
    ...updateMutationOpts,
    onSuccess: (...args) => {
      toast.success('任务已更新');
      return updateMutationOpts.onSuccess?.(...args);
    },
    onError: (error) =>
      toast.error(
        normalizeApiError(error, { fallbackMessage: '任务更新失败，请稍后重试。' }).message
      )
  });

  const createForm = useAppForm({
    defaultValues: {
      jobName: '',
      jobCode: '',
      defaultCron: '',
      cronExpression: '',
      invokeRoute: '',
      groupName: '',
      status: SCHEDULE_JOB_CREATE_STATUS.DISABLE,
      remark: ''
    } as CreateFormValues,
    validators: { onSubmit: createSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(toCreateRequest(value));
      onOpenChange(false);
    }
  });

  const editForm = useAppForm({
    defaultValues: {
      jobName: editingRecord?.jobName ?? '',
      jobCode: editingRecord?.jobCode ?? '',
      defaultCron: editingRecord?.defaultCron ?? '',
      cronExpression: editingRecord?.cronExpression ?? '',
      invokeRoute: editingRecord?.invokeRoute ?? '',
      groupName: editingRecord?.groupName ?? '',
      remark: editingRecord?.remark ?? ''
    } as EditFormValues,
    validators: { onSubmit: editSchema },
    onSubmit: async ({ value }) => {
      const editingRecordId = editingRecord?.id;
      if (!editingRecordId) return;
      await updateMutation.mutateAsync(toUpdateRequest(value, editingRecordId));
      onOpenChange(false);
    }
  });

  const { FormTextField, FormSelectField, FormTextareaField } = useFormFields<CreateFormValues>();
  const { FormTextField: EditTextField, FormTextareaField: EditTextareaField } =
    useFormFields<EditFormValues>();

  const resetForms = React.useCallback(() => {
    createForm.reset();
    editForm.reset();
  }, [createForm, editForm]);

  React.useEffect(() => {
    if (open && isEdit && editingRecord) {
      editForm.setFieldValue('jobName', editingRecord.jobName ?? '');
      editForm.setFieldValue('jobCode', editingRecord.jobCode ?? '');
      editForm.setFieldValue('defaultCron', editingRecord.defaultCron ?? '');
      editForm.setFieldValue('cronExpression', editingRecord.cronExpression ?? '');
      editForm.setFieldValue('invokeRoute', editingRecord.invokeRoute ?? '');
      editForm.setFieldValue('groupName', editingRecord.groupName ?? '');
      editForm.setFieldValue('remark', editingRecord.remark ?? '');
    }
  }, [open, isEdit, editingRecord, editForm]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        autoFocusFirstField
        onAfterClose={resetForms}
        className='flex max-w-xl flex-col'
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑任务' : '新增任务'}</SheetTitle>
          <SheetDescription>
            {isEdit ? '修改定时任务的名称、调度表达式和调用路由。' : '创建一个新的定时任务。'}
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-auto'>
          {isEdit ? (
            <editForm.AppForm>
              <editForm.Form id={formId} className='gap-4'>
                <EditTextField
                  name='jobName'
                  label='任务名称'
                  required
                  placeholder='例如 数据同步'
                />
                <div className='space-y-2 rounded-lg border bg-muted/20 px-4 py-3'>
                  <div className='text-muted-foreground text-xs tracking-[0.18em]'>任务编码</div>
                  <Input value={editingRecord?.jobCode ?? ''} disabled />
                </div>
                <EditTextField name='defaultCron' label='默认 Cron' placeholder='0 0/5 * * * ?' />
                <editForm.AppField
                  name='cronExpression'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>当前 Cron</field.FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id={field.name}
                            name={field.name}
                            value={field.state.value ?? ''}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder='0 0/5 * * * ?'
                            aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                          />
                          <InputGroupAddon align='inline-end'>
                            <ScheduleJobCronPreviewPopover
                              cronExpression={field.state.value}
                              disabled={isPending}
                            />
                          </InputGroupAddon>
                        </InputGroup>
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
                <EditTextField
                  name='invokeRoute'
                  label='调用路由'
                  placeholder='http://... 或 bean://bean.method'
                />
                <EditTextField name='groupName' label='任务分组' placeholder='例如 消息服务' />
                <EditTextareaField name='remark' label='备注' placeholder='可选备注信息' rows={3} />
              </editForm.Form>
            </editForm.AppForm>
          ) : (
            <createForm.AppForm>
              <createForm.Form id={formId} className='gap-4'>
                <FormTextField
                  name='jobName'
                  label='任务名称'
                  required
                  placeholder='例如 数据同步'
                />
                <FormTextField
                  name='jobCode'
                  label='任务编码'
                  required
                  placeholder='例如 dataSyncJob'
                />
                <FormTextField name='defaultCron' label='默认 Cron' placeholder='0 0/5 * * * ?' />
                <createForm.AppField
                  name='cronExpression'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>当前 Cron</field.FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id={field.name}
                            name={field.name}
                            value={field.state.value ?? ''}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder='0 0/5 * * * ?'
                            aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                          />
                          <InputGroupAddon align='inline-end'>
                            <ScheduleJobCronPreviewPopover
                              cronExpression={field.state.value}
                              disabled={isPending}
                            />
                          </InputGroupAddon>
                        </InputGroup>
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
                <FormTextField
                  name='invokeRoute'
                  label='调用路由'
                  placeholder='http://... 或 bean://bean.method'
                />
                <FormTextField name='groupName' label='任务分组' placeholder='例如 消息服务' />
                <FormSelectField
                  name='status'
                  label='初始状态'
                  options={[...statusOptions]}
                  placeholder='请选择状态'
                />
                <FormTextareaField name='remark' label='备注' placeholder='可选备注信息' rows={3} />
              </createForm.Form>
            </createForm.AppForm>
          )}
        </div>

        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form={formId} disabled={isPending}>
            {isEdit ? '保存修改' : '创建任务'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
