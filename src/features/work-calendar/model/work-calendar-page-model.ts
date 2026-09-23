import { type WorkCalendarYearDetailRspDTO } from '@/lib/api/clients/service';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { type WorkCalendarDraftFormValue } from './work-calendar-model';

export const WorkCalendarYearDetailReqDTOView = {
  draft: 'draft',
  active: 'active'
} as const;

export const WORK_CALENDAR_CLASSIFICATION_BASIS = {
  weeklyFallback: 'weekly_fallback'
} as const;

export type WorkCalendarYearDetailReqDTOView =
  (typeof WorkCalendarYearDetailReqDTOView)[keyof typeof WorkCalendarYearDetailReqDTOView];

export type WorkCalendarViewMode = 'draft' | 'active';

export function toSaveRequest(value: WorkCalendarDraftFormValue) {
  return {
    year: value.year,
    draftVersionId: value.draftVersionId,
    expectedLockVersion: value.expectedLockVersion,
    standardPeriods: value.standardPeriods,
    dateOverrides: value.dateOverrides.map((override) => ({
      date: override.date,
      type: override.type,
      name: override.name,
      customPeriods: override.customPeriods,
      sourceNote: override.sourceNote
    }))
  };
}

export function toOperationError(error: unknown, fallback: string) {
  const info = normalizeApiError(error, { fallbackMessage: fallback });
  switch (info.code) {
    case 3005003:
      return '草稿已被其他操作更新。请重新加载后再继续编辑。';
    case 3005004:
    case 3005005:
      return '工作时段无效或存在重叠，请检查开始和结束时间。';
    case 3005006:
      return '特殊日期配置不合法，请检查日期类型、名称与自定义时段。';
    case 3005007:
      return 'JSON 文件不符合导入格式或超过大小限制。';
    case 3005008:
      return '全年规则校验未通过，请修正后重新预检。';
    default:
      return info.message;
  }
}

export function requireResponse<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

export function resolveWorkCalendarViewMode(
  detail: WorkCalendarYearDetailRspDTO,
  requestedView?: WorkCalendarViewMode
): WorkCalendarViewMode {
  if (requestedView === WorkCalendarYearDetailReqDTOView.draft) {
    return WorkCalendarYearDetailReqDTOView.draft;
  }
  if (requestedView === WorkCalendarYearDetailReqDTOView.active && detail.activeVersion) {
    return WorkCalendarYearDetailReqDTOView.active;
  }
  return detail.draftVersion || !detail.activeVersion
    ? WorkCalendarYearDetailReqDTOView.draft
    : WorkCalendarYearDetailReqDTOView.active;
}
