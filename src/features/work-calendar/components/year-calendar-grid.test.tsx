import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { YearCalendarGrid } from './year-calendar-grid';

afterEach(() => cleanup());

describe('YearCalendarGrid', () => {
  it('shows holiday and adjusted-workday semantics without losing weekend traits', () => {
    render(
      <YearCalendarGrid
        year={2026}
        days={[
          {
            date: '2026-10-04',
            dayOfWeek: 7,
            effectiveDayKind: 'public_holiday',
            traits: ['weekend', 'public_holiday'],
            dateName: '国庆节、中秋节'
          },
          {
            date: '2026-10-10',
            dayOfWeek: 6,
            effectiveDayKind: 'adjusted_workday',
            traits: ['weekend', 'adjusted_workday']
          },
          {
            date: '2026-10-05',
            dayOfWeek: 1,
            effectiveDayKind: 'regular_workday'
          },
          {
            date: '2026-10-06',
            dayOfWeek: 2,
            effectiveDayKind: 'other_non_working_day'
          }
        ]}
        pendingOverrides={new Map()}
        pendingRemovedDates={new Set()}
        onSelectDate={vi.fn()}
      />
    );

    const holiday = screen.getByRole('button', {
      name: /2026-10-04，星期日，法定节假日，国庆节、中秋节，特征：周末、法定节假日/
    });
    const adjustedWorkday = screen.getByRole('button', {
      name: /2026-10-10，星期六，调休工作日，特征：周末、调休工作日/
    });
    const regularWorkday = screen.getByRole('button', {
      name: /2026-10-05，星期一，普通工作日/
    });
    const otherNonWorkingDay = screen.getByRole('button', {
      name: /2026-10-06，星期二，其他非工作日/
    });

    expect(holiday).toHaveAttribute('data-day-kind', 'public_holiday');
    expect(holiday).toHaveTextContent('假');
    expect(adjustedWorkday).toHaveAttribute('data-day-kind', 'adjusted_workday');
    expect(adjustedWorkday).toHaveTextContent('班');
    expect(regularWorkday).toHaveClass('bg-background', 'text-foreground', 'hover:text-foreground');
    expect(otherNonWorkingDay).toHaveClass(
      'bg-secondary',
      'text-secondary-foreground',
      'hover:text-accent-foreground'
    );
  });

  it('keeps active snapshot dates read-only', () => {
    const onSelectDate = vi.fn();

    render(
      <YearCalendarGrid
        year={2026}
        days={[
          {
            date: '2026-01-01',
            dayOfWeek: 4,
            effectiveDayKind: 'regular_workday'
          }
        ]}
        pendingOverrides={new Map()}
        pendingRemovedDates={new Set()}
        readOnly
        onSelectDate={onSelectDate}
      />
    );

    expect(screen.getByRole('button', { name: /2026-01-01/u })).toBeDisabled();
    expect(onSelectDate).not.toHaveBeenCalled();
  });
});

vi.mock('@/hooks/use-dict', () => ({
  useDict: () => ({
    getLabel: (code: string) =>
      ({
        public_holiday: '法定节假日',
        adjusted_workday: '调休工作日',
        regular_workday: '普通工作日',
        other_non_working_day: '其他非工作日',
        weekend: '周末',
        saved_draft: '已保存草稿',
        published_snapshot: '已发布快照'
      })[code] ?? code
  })
}));
