import { useDict, dictionaryOptionsWithCodeFallback } from '@/hooks/use-dict';
import type * as z from 'zod';

import { Icons } from '@/components/icons';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';

import {
  createDefaultPeriod,
  dateOverrideEditorSchema,
  getPeriodValidationMessage,
  WORK_CALENDAR_OVERRIDE_TYPES,
  type WorkCalendarDateOverrideValue,
  type WorkCalendarPeriodValue
} from '../model/work-calendar-model';

type DateOverrideEditorValue = z.infer<typeof dateOverrideEditorSchema>;

interface DateOverrideSheetProps {
  open: boolean;
  date: string;
  override?: WorkCalendarDateOverrideValue;
  standardPeriods: WorkCalendarPeriodValue[];
  onOpenChange: (open: boolean) => void;
  onAfterClose?: () => void;
  onCommit: (date: string, override: WorkCalendarDateOverrideValue | null) => void;
}

export function DateOverrideSheet({
  open,
  date,
  override,
  standardPeriods,
  onOpenChange,
  onAfterClose,
  onCommit
}: DateOverrideSheetProps) {
  const dictionary = useDict('WORK_CALENDAR_DATE_OVERRIDE_TYPE');
  const overrideOptions = dictionaryOptionsWithCodeFallback(
    dictionary.options,
    WORK_CALENDAR_OVERRIDE_TYPES
  );
  const form = useAppForm({
    defaultValues: {
      type: override?.type ?? 'public_holiday',
      name: override?.name ?? '',
      sourceNote: override?.sourceNote ?? '',
      customPeriods: override?.customPeriods ?? []
    } satisfies DateOverrideEditorValue,
    validators: { onSubmit: dateOverrideEditorSchema },
    onSubmit: ({ value }) => {
      onCommit(date, {
        date,
        type: value.type,
        name: value.name.trim() || undefined,
        sourceNote: value.sourceNote.trim() || undefined,
        customPeriods:
          value.type === 'adjusted_workday' && value.customPeriods.length > 0
            ? value.customPeriods
            : undefined
      });
      onOpenChange(false);
    }
  });
  const { FormSelectField, FormTextField, FormTextareaField } =
    useFormFields<DateOverrideEditorValue>();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        autoFocusFirstField
        onAfterClose={onAfterClose}
        className='flex w-full max-w-xl flex-col sm:max-w-xl'
      >
        <SheetHeader>
          <SheetTitle>设置特殊日期</SheetTitle>
          <SheetDescription>
            {date} · 周末由系统自动推导，仅在这里配置节假日、调休或其他休息日。
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          <form.AppForm>
            <form.Form id='work-calendar-date-override-form' className='gap-5 p-0 md:p-0'>
              <FormSelectField
                name='type'
                label='日期类型'
                required
                options={[...overrideOptions]}
              />
              <FormTextField
                name='name'
                label='名称'
                placeholder='例如 国庆节、中秋节'
                maxLength={128}
              />
              <FormTextareaField
                name='sourceNote'
                label='来源备注'
                placeholder='例如 国务院办公厅 2026 年放假通知'
                maxLength={256}
                rows={3}
              />

              <form.Subscribe selector={(state) => state.values}>
                {(value) =>
                  value.type === 'adjusted_workday' ? (
                    <PeriodEditor
                      periods={value.customPeriods}
                      inheritedPeriods={standardPeriods}
                      onChange={(periods) => form.setFieldValue('customPeriods', periods)}
                    />
                  ) : null
                }
              </form.Subscribe>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter className='flex-row flex-wrap justify-between gap-2'>
          <div>
            {override && (
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  onCommit(date, null);
                  onOpenChange(false);
                }}
              >
                移除特殊设置
              </Button>
            )}
          </div>
          <Button type='submit' form='work-calendar-date-override-form'>
            应用到草稿
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface PeriodEditorProps {
  periods: WorkCalendarPeriodValue[];
  inheritedPeriods: WorkCalendarPeriodValue[];
  onChange: (periods: WorkCalendarPeriodValue[]) => void;
}

function PeriodEditor({ periods, inheritedPeriods, onChange }: PeriodEditorProps) {
  const validationMessage = getPeriodValidationMessage(periods);
  return (
    <fieldset className='space-y-3 rounded-lg border p-4'>
      <legend className='px-1 text-sm font-medium'>自定义工作时段</legend>
      <p className='text-xs text-muted-foreground'>
        不添加时段即继承标准时段：{formatPeriods(inheritedPeriods) || '尚未配置'}。
      </p>
      {periods.map((period, index) => (
        <div key={index} className='flex items-center gap-2'>
          <Input
            aria-label={`第 ${index + 1} 个自定义时段开始时间`}
            type='time'
            value={period.start}
            onChange={(event) =>
              onChange(updatePeriod(periods, index, 'start', event.target.value))
            }
          />
          <span className='text-muted-foreground'>至</span>
          <Input
            aria-label={`第 ${index + 1} 个自定义时段结束时间`}
            type='time'
            value={period.end}
            onChange={(event) => onChange(updatePeriod(periods, index, 'end', event.target.value))}
          />
          <Button
            type='button'
            size='icon'
            variant='ghost'
            aria-label={`删除第 ${index + 1} 个自定义时段`}
            onClick={() => onChange(periods.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Icons.trash className='size-4' />
          </Button>
        </div>
      ))}
      <Button
        type='button'
        size='sm'
        variant='outline'
        disabled={periods.length >= 8}
        onClick={() => onChange([...periods, createDefaultPeriod(periods)])}
      >
        <Icons.add className='size-4' />
        添加自定义时段
      </Button>
      {validationMessage && <p className='text-sm text-destructive'>{validationMessage}</p>}
    </fieldset>
  );
}

function updatePeriod(
  periods: WorkCalendarPeriodValue[],
  index: number,
  field: keyof WorkCalendarPeriodValue,
  value: string
) {
  return periods.map((period, itemIndex) =>
    itemIndex === index ? { ...period, [field]: value } : period
  );
}

function formatPeriods(periods: WorkCalendarPeriodValue[]) {
  return periods.map((period) => `${period.start}–${period.end}`).join('、');
}
