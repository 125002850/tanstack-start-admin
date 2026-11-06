import { zhCN } from 'date-fns/locale';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { normalizeConditionDateTime } from '../lib/condition-date-time';

interface ConditionDateTimePickerProps extends Pick<
  React.AriaAttributes,
  'aria-invalid' | 'aria-describedby'
> {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly onChange: (value: string) => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly value: string;
}

export function ConditionDateTimePicker({
  ariaLabel,
  className,
  disabled,
  id,
  onChange,
  onOpenChange,
  open: controlledOpen,
  value,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy
}: ConditionDateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const localValue = toShanghaiDateTimeLocalValue(value);
  const parts = parseLocalDateTime(localValue);
  const selected = parts === null ? undefined : toLocalDate(parts);
  const timeValue = parts === null ? '00:00:00' : formatTime(parts);
  const [displayMonth, setDisplayMonth] = React.useState(() =>
    startOfPickerMonth(selected ?? new Date())
  );
  const [timeDraft, setTimeDraft] = React.useState(timeValue);

  React.useEffect(() => {
    setTimeDraft(timeValue);
  }, [timeValue]);

  const currentOpen = controlledOpen ?? open;
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDisplayMonth(startOfPickerMonth(selected ?? new Date()));
    if (controlledOpen === undefined) setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const selectDate = (date: Date | undefined) => {
    if (date === undefined) return;
    setDisplayMonth(startOfPickerMonth(date));
    const time = parts ?? EMPTY_DATE_TIME_PARTS;
    onChange(
      serializeShanghaiDateTime(
        formatLocalDateTime({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: time.hour,
          minute: time.minute,
          second: time.second
        })
      )
    );
  };

  const changeTime = (time: string) => {
    setTimeDraft(time);
    if (parts === null) return;
    const nextTime = parseTime(time);
    if (nextTime === null) return;
    onChange(serializeShanghaiDateTime(formatLocalDateTime({ ...parts, ...nextTime })));
  };

  return (
    <Popover onOpenChange={handleOpenChange} open={currentOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'nodrag nopan w-full justify-start border-border/70 bg-background/70 font-normal tabular-nums hover:border-primary/40 hover:bg-accent/50 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/15',
            localValue.length === 0 && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          id={id}
          type='button'
          variant='outline'
        >
          <Icons.calendar className='size-4' data-icon='inline-start' />
          <span className='truncate'>
            {localValue.length === 0 ? '选择日期和时间' : localValue.replace('T', ' ')}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='center'
        className='nodrag nopan max-h-[calc(100vh-1.5rem)] w-[19rem] overflow-y-auto rounded-xl border-border/80 p-0 shadow-xl'
        collisionPadding={12}
        side='left'
        sideOffset={8}
      >
        <div className='flex h-12 items-center justify-between border-b border-border/70 bg-muted/25 px-2.5'>
          <Button
            aria-label='上个月'
            className='size-8'
            onClick={() => setDisplayMonth((month) => shiftPickerMonth(month, -1))}
            size='icon'
            type='button'
            variant='ghost'
          >
            <Icons.chevronLeft className='size-4' />
          </Button>
          <span className='text-sm font-semibold tracking-tight'>
            {formatPickerMonth(displayMonth)}
          </span>
          <Button
            aria-label='下个月'
            className='size-8'
            onClick={() => setDisplayMonth((month) => shiftPickerMonth(month, 1))}
            size='icon'
            type='button'
            variant='ghost'
          >
            <Icons.chevronRight className='size-4' />
          </Button>
        </div>
        <Calendar
          className='relative p-0'
          classNames={{
            month: 'flex flex-col gap-3 px-3 pb-3',
            month_caption: 'sr-only',
            weekdays: 'flex w-full',
            weekday: 'w-9 text-center text-xs font-medium text-muted-foreground',
            week: 'mt-1.5 flex w-full',
            day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
            day_button:
              'inline-flex size-9 items-center justify-center rounded-lg text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:opacity-100 aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground',
            selected:
              'rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
            today: 'rounded-lg bg-accent font-semibold text-accent-foreground',
            outside: 'text-muted-foreground/60 aria-selected:text-muted-foreground',
            disabled: 'text-muted-foreground opacity-40'
          }}
          hideNavigation
          locale={zhCN}
          mode='single'
          month={displayMonth}
          onMonthChange={(month) => setDisplayMonth(startOfPickerMonth(month))}
          onSelect={selectDate}
          selected={selected}
        />
        <Separator />
        <div className='bg-muted/20 px-3 py-3'>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <label className='text-xs font-medium' htmlFor={`${id}-time`}>
              具体时间
            </label>
            <span className='text-muted-foreground text-[0.6875rem]'>精确到秒</span>
          </div>
          <div className='focus-within:border-ring focus-within:ring-ring/40 flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]'>
            <Icons.clock className='text-primary-text size-4 shrink-0' />
            <Input
              aria-label={`${ariaLabel}时间`}
              className='h-9 flex-1 border-0 bg-transparent px-1 font-mono tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent'
              disabled={selected === undefined}
              id={`${id}-time`}
              onChange={(event) => changeTime(event.target.value)}
              onBlur={() => {
                if (parseTime(timeDraft) === null) setTimeDraft(timeValue);
              }}
              inputMode='numeric'
              maxLength={8}
              placeholder='HH:mm:ss'
              type='text'
              value={timeDraft}
            />
          </div>
        </div>
        <Separator />
        <div className='bg-muted/35 flex items-center justify-end gap-3 px-3 py-2.5'>
          <div className='flex items-center gap-1.5'>
            {value.length === 0 ? null : (
              <Button
                onClick={() => {
                  onChange('');
                  handleOpenChange(false);
                }}
                size='sm'
                type='button'
                variant='ghost'
              >
                清空
              </Button>
            )}
            <Button onClick={() => handleOpenChange(false)} size='sm' type='button'>
              完成
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const EMPTY_DATE_TIME_PARTS: DateTimeParts = {
  year: 1970,
  month: 1,
  day: 1,
  hour: 0,
  minute: 0,
  second: 0
};

function parseLocalDateTime(value: string): DateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(value);
  if (match === null) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0)
  };
}

function parseTime(value: string): Pick<DateTimeParts, 'hour' | 'minute' | 'second'> | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(value);
  if (match === null) return null;
  const parts = {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? 0)
  };
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null;
  return parts;
}

function toLocalDate(parts: DateTimeParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function formatLocalDateTime(parts: DateTimeParts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${formatTime(parts)}`;
}

function formatTime(parts: Pick<DateTimeParts, 'hour' | 'minute' | 'second'>): string {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function startOfPickerMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftPickerMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatPickerMonth(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function serializeShanghaiDateTime(localValue: string): string {
  if (localValue.length === 0) return '';
  const parts = parseLocalDateTime(localValue);
  if (parts === null) return localValue;
  return formatLocalDateTime(parts).replace('T', ' ');
}

function toShanghaiDateTimeLocalValue(value: string): string {
  if (value.length === 0) return '';
  return normalizeConditionDateTime(value)?.replace(' ', 'T') ?? '';
}
