import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createDefaultPeriod,
  getPeriodValidationMessage,
  type WorkCalendarPeriodValue
} from '../model/work-calendar-model';

export function StandardPeriodsEditor({
  periods,
  readOnly,
  onChange
}: {
  periods: WorkCalendarPeriodValue[];
  readOnly: boolean;
  onChange: (periods: WorkCalendarPeriodValue[]) => void;
}) {
  const validationMessage = getPeriodValidationMessage(periods);
  return (
    <Card className='h-auto'>
      <CardHeader>
        <CardTitle>标准工作时段</CardTitle>
        <CardDescription>
          适用于普通工作日及未自定义时段的调休工作日；区间采用左闭右开规则。
        </CardDescription>
      </CardHeader>
      <CardContent className='gap-3'>
        {periods.length === 0 && (
          <p className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
            尚未配置标准时段。添加至少一个时段后才能保存草稿。
          </p>
        )}
        {periods.map((period, index) => (
          <div key={index} className='flex max-w-lg items-center gap-2'>
            <Input
              type='time'
              disabled={readOnly}
              aria-label={`第 ${index + 1} 个标准时段开始时间`}
              value={period.start}
              onChange={(event) =>
                onChange(updatePeriod(periods, index, 'start', event.target.value))
              }
            />
            <span className='text-sm text-muted-foreground'>至</span>
            <Input
              type='time'
              disabled={readOnly}
              aria-label={`第 ${index + 1} 个标准时段结束时间`}
              value={period.end}
              onChange={(event) =>
                onChange(updatePeriod(periods, index, 'end', event.target.value))
              }
            />
            {!readOnly && (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                aria-label={`删除第 ${index + 1} 个标准时段`}
                onClick={() => onChange(periods.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Icons.trash className='size-4' />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={periods.length >= 8}
            onClick={() => onChange([...periods, createDefaultPeriod(periods)])}
          >
            <Icons.add className='size-4' />
            添加时段
          </Button>
        )}
        {!readOnly && validationMessage && (
          <p className='text-sm text-destructive'>{validationMessage}</p>
        )}
      </CardContent>
    </Card>
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
