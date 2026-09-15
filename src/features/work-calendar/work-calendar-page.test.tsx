import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkCalendarYearDetailRspDTO } from '@/lib/api/clients/service';

import {
  Header,
  resolveWorkCalendarViewMode,
  type WorkCalendarViewMode
} from './work-calendar-page';

afterEach(() => cleanup());

const detail = {
  year: 2026,
  zoneId: 'Asia/Shanghai',
  viewBasis: 'saved_draft',
  authoritative: false,
  activeVersion: { versionId: 10, versionNo: 2 },
  draftVersion: { versionId: 11, versionNo: 3, lockVersion: 0 },
  standardPeriods: [],
  dateOverrides: [],
  resolvedDays: []
} as WorkCalendarYearDetailRspDTO;

function renderHeader({
  dirty,
  viewMode,
  onViewModeChange = vi.fn()
}: {
  dirty: boolean;
  viewMode: WorkCalendarViewMode;
  onViewModeChange?: (mode: WorkCalendarViewMode) => void;
}) {
  return render(
    <Header
      year={2026}
      detail={detail}
      dirty={dirty}
      viewMode={viewMode}
      refreshing={false}
      saving={false}
      preparing={false}
      onYearChange={vi.fn()}
      onViewModeChange={onViewModeChange}
      onSave={vi.fn()}
      onImport={vi.fn()}
      onEvaluate={vi.fn()}
      onPublish={vi.fn()}
    />
  );
}

describe('work calendar version view', () => {
  it('defaults to the draft when present and to the active snapshot otherwise', () => {
    expect(resolveWorkCalendarViewMode(detail)).toBe('draft');
    expect(resolveWorkCalendarViewMode({ ...detail, draftVersion: undefined })).toBe('active');
    expect(
      resolveWorkCalendarViewMode(
        { ...detail, draftVersion: undefined, activeVersion: undefined },
        undefined
      )
    ).toBe('draft');
  });

  it('shows save only for a modified draft view', () => {
    const rendered = renderHeader({ dirty: false, viewMode: 'draft' });

    expect(screen.queryByRole('button', { name: /保存草稿/u })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '草稿试算' })).toBeInTheDocument();

    rendered.rerender(
      <Header
        year={2026}
        detail={detail}
        dirty
        viewMode='draft'
        refreshing={false}
        saving={false}
        preparing={false}
        onYearChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onSave={vi.fn()}
        onImport={vi.fn()}
        onEvaluate={vi.fn()}
        onPublish={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /保存草稿/u })).toBeInTheDocument();
  });

  it('renders the active version as read-only and switches through the version control', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    const rendered = renderHeader({ dirty: true, viewMode: 'draft', onViewModeChange });

    await user.click(screen.getByRole('radio', { name: '生效 v2' }));
    expect(onViewModeChange).toHaveBeenCalledWith('active');

    rendered.rerender(
      <Header
        year={2026}
        detail={{ ...detail, viewBasis: 'published_snapshot' }}
        dirty={false}
        viewMode='active'
        refreshing={false}
        saving={false}
        preparing={false}
        onYearChange={vi.fn()}
        onViewModeChange={onViewModeChange}
        onSave={vi.fn()}
        onImport={vi.fn()}
        onEvaluate={vi.fn()}
        onPublish={vi.fn()}
      />
    );

    expect(screen.getByText('当前生效快照（只读）')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存草稿/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /发布/u })).not.toBeInTheDocument();
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
