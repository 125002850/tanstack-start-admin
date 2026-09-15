import * as z from 'zod';

import {
  type ResolvedCalendarDayRspDTO,
  type WorkCalendarDateOverrideRspDTO,
  type WorkCalendarYearDetailRspDTO
} from '@/lib/api/clients/service';

export const WORK_CALENDAR_OVERRIDE_TYPE = {
  adjusted_workday: 'adjusted_workday',
  public_holiday: 'public_holiday',
  other_non_working_day: 'other_non_working_day'
} as const;
export const WORK_CALENDAR_OVERRIDE_TYPES = [
  WORK_CALENDAR_OVERRIDE_TYPE.adjusted_workday,
  WORK_CALENDAR_OVERRIDE_TYPE.public_holiday,
  WORK_CALENDAR_OVERRIDE_TYPE.other_non_working_day
] as const;

export const WORK_CALENDAR_MIN_YEAR = 2_000;
export const WORK_CALENDAR_MAX_YEAR = 2_099;
export const WORK_CALENDAR_MAX_PERIODS = 8;
export const WORK_CALENDAR_MAX_DATE_OVERRIDES = 366;
export const WORK_CALENDAR_TIME_ZONE = 'Asia/Shanghai';

export type WorkCalendarOverrideType = (typeof WORK_CALENDAR_OVERRIDE_TYPES)[number];

export interface WorkCalendarPeriodValue {
  start: string;
  end: string;
}

export interface WorkCalendarDateOverrideValue {
  date: string;
  type: WorkCalendarOverrideType;
  name?: string;
  customPeriods?: WorkCalendarPeriodValue[];
  sourceNote?: string;
}

export interface WorkCalendarDraftFormValue {
  year: number;
  draftVersionId?: number;
  expectedLockVersion?: number;
  standardPeriods: WorkCalendarPeriodValue[];
  dateOverrides: WorkCalendarDateOverrideValue[];
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const periodSchema = z
  .object({
    start: z.string().regex(timePattern, '请输入有效开始时间'),
    end: z.string().regex(timePattern, '请输入有效结束时间')
  })
  .refine((period) => period.start < period.end, {
    message: '结束时间必须晚于开始时间',
    path: ['end']
  });

const periodListSchema = z
  .array(periodSchema)
  .max(WORK_CALENDAR_MAX_PERIODS, `最多配置 ${WORK_CALENDAR_MAX_PERIODS} 个工作时段`)
  .superRefine((periods, context) => {
    const sorted = periods
      .map((period, index) => ({ ...period, index }))
      .toSorted((left, right) => left.start.localeCompare(right.start));
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index]!.start < sorted[index - 1]!.end) {
        context.addIssue({
          code: 'custom',
          message: '工作时段不能重叠',
          path: [sorted[index]!.index, 'start']
        });
      }
    }
  });

const dateOverrideSchema = z
  .object({
    date: z.iso.date('日期格式应为 yyyy-MM-dd'),
    type: z.enum(WORK_CALENDAR_OVERRIDE_TYPES),
    name: z.string().trim().max(128, '名称不能超过 128 个字符').optional(),
    customPeriods: periodListSchema.optional(),
    sourceNote: z.string().trim().max(256, '来源备注不能超过 256 个字符').optional()
  })
  .superRefine((override, context) => {
    if (override.type !== WORK_CALENDAR_OVERRIDE_TYPE.adjusted_workday && !override.name) {
      context.addIssue({ code: 'custom', message: '请输入日期名称', path: ['name'] });
    }
    if (
      override.type !== WORK_CALENDAR_OVERRIDE_TYPE.adjusted_workday &&
      override.customPeriods !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: '只有调休工作日可以设置自定义时段',
        path: ['customPeriods']
      });
    }
    if (override.customPeriods?.length === 0) {
      context.addIssue({
        code: 'custom',
        message: '不自定义时请使用继承标准时段',
        path: ['customPeriods']
      });
    }
  });

export const dateOverrideEditorSchema = z
  .object({
    type: z.enum(WORK_CALENDAR_OVERRIDE_TYPES),
    name: z.string().trim().max(128, '名称不能超过 128 个字符'),
    sourceNote: z.string().trim().max(256, '来源备注不能超过 256 个字符'),
    customPeriods: periodListSchema
  })
  .superRefine((value, context) => {
    if (value.type !== WORK_CALENDAR_OVERRIDE_TYPE.adjusted_workday && !value.name.trim()) {
      context.addIssue({ code: 'custom', message: '请输入日期名称', path: ['name'] });
    }
  });

export const workCalendarDraftSchema = z
  .object({
    year: z.number().int().min(WORK_CALENDAR_MIN_YEAR).max(WORK_CALENDAR_MAX_YEAR),
    draftVersionId: z.number().positive().optional(),
    expectedLockVersion: z.number().int().min(0).optional(),
    standardPeriods: periodListSchema.min(1, '至少配置一个标准工作时段'),
    dateOverrides: z.array(dateOverrideSchema).max(WORK_CALENDAR_MAX_DATE_OVERRIDES)
  })
  .superRefine((value, context) => {
    const seenDates = new Set<string>();
    value.dateOverrides.forEach((override, index) => {
      if (!override.date.startsWith(`${value.year}-`)) {
        context.addIssue({
          code: 'custom',
          message: '特殊日期必须属于当前年份',
          path: ['dateOverrides', index, 'date']
        });
      }
      if (seenDates.has(override.date)) {
        context.addIssue({
          code: 'custom',
          message: '同一天只能配置一个特殊日期',
          path: ['dateOverrides', index, 'date']
        });
      }
      seenDates.add(override.date);
    });
  });

export function toDraftFormValue(
  detail: WorkCalendarYearDetailRspDTO,
  fallbackYear: number
): WorkCalendarDraftFormValue {
  const year = detail.year ?? fallbackYear;
  const dateOverrides = (detail.dateOverrides ?? []).map(toDateOverrideValue);
  return {
    year,
    draftVersionId: detail.draftVersion?.versionId,
    expectedLockVersion: detail.draftVersion?.lockVersion,
    standardPeriods: (detail.standardPeriods ?? []).map((period) => ({
      start: period.start ?? '',
      end: period.end ?? ''
    })),
    dateOverrides
  };
}

export function toDateOverrideValue(
  override: WorkCalendarDateOverrideRspDTO
): WorkCalendarDateOverrideValue {
  const code = override.type;
  if (!isOverrideType(code) || !override.date) {
    throw new Error(`Unsupported work calendar override: ${String(code)}`);
  }
  return {
    date: override.date,
    type: code,
    name: override.name ?? undefined,
    customPeriods: override.customPeriods?.map((period) => ({
      start: period.start ?? '',
      end: period.end ?? ''
    })),
    sourceNote: override.sourceNote ?? undefined
  };
}

export function getDayKindCode(day: ResolvedCalendarDayRspDTO | undefined) {
  const code = day?.effectiveDayKind;
  switch (code) {
    case 'regular_workday':
    case 'adjusted_workday':
    case 'weekend':
    case 'public_holiday':
    case 'other_non_working_day':
      return code;
    default:
      return 'unknown' as const;
  }
}

export function indexOverrides(overrides: WorkCalendarDateOverrideValue[]) {
  return new Map(overrides.map((override) => [override.date, override]));
}

export function findChangedDates(
  baseline: WorkCalendarDateOverrideValue[],
  current: WorkCalendarDateOverrideValue[]
) {
  const baselineByDate = indexOverrides(baseline);
  const currentByDate = indexOverrides(current);
  const changed = new Set<string>();
  const removed = new Set<string>();

  for (const [date, override] of currentByDate) {
    if (JSON.stringify(override) !== JSON.stringify(baselineByDate.get(date))) {
      changed.add(date);
    }
  }
  for (const date of baselineByDate.keys()) {
    if (!currentByDate.has(date)) {
      removed.add(date);
    }
  }
  return { changed, removed };
}

export function createDefaultPeriod(periods: WorkCalendarPeriodValue[]): WorkCalendarPeriodValue {
  if (periods.length === 0) return { start: '09:00', end: '12:00' };
  const previous = periods.at(-1)!;
  if (previous.end < '18:00') return { start: previous.end, end: '18:00' };
  return { start: '09:00', end: '12:00' };
}

export function getPeriodValidationMessage(periods: WorkCalendarPeriodValue[]) {
  const result = periodListSchema.safeParse(periods);
  return result.success ? null : (result.error.issues[0]?.message ?? '工作时段不合法');
}

export function formatShanghaiCurrentYear() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: WORK_CALENDAR_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'year')?.value ?? new Date().getFullYear());
}

function isOverrideType(value: unknown): value is WorkCalendarOverrideType {
  return WORK_CALENDAR_OVERRIDE_TYPES.includes(value as WorkCalendarOverrideType);
}
