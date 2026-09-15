// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { WorkCalendarYearDetailRspDTO } from '@/lib/api/clients/service';

import { toDraftFormValue, workCalendarDraftSchema } from './work-calendar-model';

describe('work calendar model', () => {
  it('maps response enum objects into stable draft codes', () => {
    const detail: WorkCalendarYearDetailRspDTO = {
      year: 2026,
      draftVersion: { versionId: 12, lockVersion: 3 },
      standardPeriods: [{ start: '09:00', end: '12:00' }],
      dateOverrides: [
        {
          date: '2026-10-04',
          type: 'public_holiday',
          name: '国庆节、中秋节'
        }
      ]
    };

    expect(toDraftFormValue(detail, 2025)).toEqual({
      year: 2026,
      draftVersionId: 12,
      expectedLockVersion: 3,
      standardPeriods: [{ start: '09:00', end: '12:00' }],
      dateOverrides: [
        {
          date: '2026-10-04',
          type: 'public_holiday',
          name: '国庆节、中秋节',
          customPeriods: undefined,
          sourceNote: undefined
        }
      ]
    });
  });

  it('fails closed when the backend returns an unknown override type', () => {
    expect(() =>
      toDraftFormValue(
        {
          year: 2026,
          dateOverrides: [
            {
              date: '2026-01-01',
              type: 'future_type' as never
            }
          ]
        },
        2026
      )
    ).toThrow('Unsupported work calendar override');
  });

  it('rejects overlapping periods and unnamed non-working overrides', () => {
    const result = workCalendarDraftSchema.safeParse({
      year: 2026,
      standardPeriods: [
        { start: '09:00', end: '12:00' },
        { start: '11:00', end: '18:00' }
      ],
      dateOverrides: [
        {
          date: '2026-12-31',
          type: 'other_non_working_day',
          name: ''
        }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(['工作时段不能重叠', '请输入日期名称'])
      );
    }
  });
});
