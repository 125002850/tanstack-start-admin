import { useDict } from '@/hooks/use-dict';
import * as React from 'react';

import { cn } from '@/lib/utils';
import type { ResolvedCalendarDayRspDTO } from '@/lib/api/clients/service';

import {
  getDayKindCode,
  WORK_CALENDAR_TIME_ZONE,
  type WorkCalendarDateOverrideValue
} from '../model/work-calendar-model';

const MONTH_NAMES = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月'
] as const;
const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'] as const;

type DayKind = ReturnType<typeof getDayKindCode>;

interface YearCalendarGridProps {
  year: number;
  days: ResolvedCalendarDayRspDTO[];
  pendingOverrides: Map<string, WorkCalendarDateOverrideValue>;
  pendingRemovedDates: Set<string>;
  readOnly?: boolean;
  onSelectDate: (date: string, trigger: HTMLButtonElement) => void;
}

export const YearCalendarGrid = React.memo(function YearCalendarGrid({
  year,
  days,
  pendingOverrides,
  pendingRemovedDates,
  readOnly = false,
  onSelectDate
}: YearCalendarGridProps) {
  const dayByDate = React.useMemo(
    () => new Map(days.flatMap((day) => (day.date ? [[day.date, day] as const] : []))),
    [days]
  );
  const today = getShanghaiToday();

  return (
    <section aria-label={`${year} 年全年日历`} className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {MONTH_NAMES.map((monthName, monthIndex) => (
        <MonthCalendar
          key={monthName}
          year={year}
          monthIndex={monthIndex}
          monthName={monthName}
          dayByDate={dayByDate}
          pendingOverrides={pendingOverrides}
          pendingRemovedDates={pendingRemovedDates}
          readOnly={readOnly}
          today={today}
          onSelectDate={onSelectDate}
        />
      ))}
    </section>
  );
});

interface MonthCalendarProps {
  year: number;
  monthIndex: number;
  monthName: string;
  dayByDate: Map<string, ResolvedCalendarDayRspDTO>;
  pendingOverrides: Map<string, WorkCalendarDateOverrideValue>;
  pendingRemovedDates: Set<string>;
  readOnly: boolean;
  today: string;
  onSelectDate: (date: string, trigger: HTMLButtonElement) => void;
}

function MonthCalendar({
  year,
  monthIndex,
  monthName,
  dayByDate,
  pendingOverrides,
  pendingRemovedDates,
  readOnly,
  today,
  onSelectDate
}: MonthCalendarProps) {
  const kinds = useDict('WORK_CALENDAR_EFFECTIVE_DAY_KIND');
  const traits = useDict('WORK_CALENDAR_DAY_TRAIT');
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmptyDays = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: leadingEmptyDays + daysInMonth }, (_, index) =>
    index < leadingEmptyDays ? null : index - leadingEmptyDays + 1
  );

  return (
    <section
      aria-label={`${year} 年${monthName}`}
      className='rounded-xl border bg-card p-4 shadow-xs'
    >
      <h3 className='mb-3 text-sm font-semibold tracking-tight'>{monthName}</h3>
      <div className='mb-1 grid grid-cols-7 gap-1' aria-hidden='true'>
        {WEEKDAY_NAMES.map((weekday) => (
          <span
            key={weekday}
            className='flex h-6 items-center justify-center text-[11px] font-medium text-muted-foreground'
          >
            {weekday}
          </span>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-1'>
        {cells.map((dayNumber, index) => {
          if (dayNumber === null) {
            return <span key={`empty-${index}`} aria-hidden='true' className='h-9' />;
          }
          const date = toDateString(year, monthIndex + 1, dayNumber);
          const day = dayByDate.get(date);
          const pendingOverride = pendingOverrides.get(date);
          const kind = pendingOverride?.type ?? getDayKindCode(day);
          const pendingRemoval = pendingRemovedDates.has(date);
          const pending = pendingOverride !== undefined || pendingRemoval;
          const label = createDayAccessibleName(
            date,
            day,
            kind,
            pending,
            pendingRemoval,
            kinds.getLabel,
            traits.getLabel
          );

          return (
            <button
              key={date}
              type='button'
              data-day-kind={kind}
              data-pending={pending || undefined}
              aria-label={label}
              title={label}
              disabled={readOnly}
              onClick={(event) => onSelectDate(date, event.currentTarget)}
              className={cn(
                'group relative flex h-9 min-w-0 items-center justify-center rounded-md border border-transparent text-xs tabular-nums outline-none transition-colors',
                readOnly
                  ? 'cursor-default'
                  : 'hover:border-border hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
                dayKindClassName(kind),
                date === today && 'ring-1 ring-primary/70',
                pending && 'border-dashed border-primary/70'
              )}
            >
              <span>{dayNumber}</span>
              {dayKindMark(kind) && (
                <span className='absolute right-0.5 bottom-0 text-[8px] font-semibold leading-none'>
                  {dayKindMark(kind)}
                </span>
              )}
              {pending && (
                <span
                  className='absolute top-0.5 right-0.5 size-1 rounded-full bg-primary'
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function dayKindClassName(kind: DayKind | WorkCalendarDateOverrideValue['type']) {
  switch (kind) {
    case 'weekend':
      return 'bg-muted/55 text-muted-foreground';
    case 'public_holiday':
      return 'bg-destructive/10 text-destructive dark:bg-destructive/15';
    case 'adjusted_workday':
      return 'bg-accent text-accent-foreground ring-1 ring-border';
    case 'other_non_working_day':
      return 'bg-secondary text-secondary-foreground';
    case 'unknown':
      return 'border-dashed bg-muted text-muted-foreground';
    default:
      return 'bg-background text-foreground hover:text-foreground';
  }
}

function dayKindMark(kind: DayKind | WorkCalendarDateOverrideValue['type']) {
  switch (kind) {
    case 'weekend':
    case 'other_non_working_day':
      return '休';
    case 'public_holiday':
      return '假';
    case 'adjusted_workday':
      return '班';
    case 'unknown':
      return '?';
    default:
      return null;
  }
}

function createDayAccessibleName(
  date: string,
  day: ResolvedCalendarDayRspDTO | undefined,
  kind: DayKind | WorkCalendarDateOverrideValue['type'],
  pending: boolean,
  pendingRemoval: boolean,
  kindLabelFor: (code: string) => string,
  traitLabelFor: (code: string) => string
) {
  const kindLabel = kindLabelFor(kind);
  const traits = day?.traits?.map(traitLabelFor).filter(Boolean).join('、');
  return [
    date,
    `星期${WEEKDAY_NAMES[(day?.dayOfWeek ?? 1) - 1] ?? ''}`,
    kindLabel ?? '未知类型',
    day?.dateName,
    traits ? `特征：${traits}` : undefined,
    pendingRemoval ? '待保存移除特殊设置' : pending ? '待保存修改' : undefined
  ]
    .filter(Boolean)
    .join('，');
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getShanghaiToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: WORK_CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}
