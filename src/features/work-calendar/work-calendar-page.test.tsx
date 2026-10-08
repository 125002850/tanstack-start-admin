import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import {
  listWorkCalendarVersionsQueryKey,
  type WorkCalendarYearDetailRspDTO
} from '@/lib/api/clients/service';

import {
  Header,
  resolveWorkCalendarViewMode,
  type WorkCalendarViewMode
} from './work-calendar-page';

afterEach(() => cleanup());
beforeEach(() => {
  Element.prototype.scrollIntoView ??= vi.fn();
});

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
  onViewModeChange = vi.fn(),
  onVersionChange = vi.fn()
}: {
  dirty: boolean;
  viewMode: WorkCalendarViewMode;
  onViewModeChange?: (mode: WorkCalendarViewMode) => void;
  onVersionChange?: (versionId: number) => void;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } }
  });
  client.setQueryData(listWorkCalendarVersionsQueryKey({ year: 2026 }), [
    { ...detail.draftVersion, status: 'draft' },
    { ...detail.activeVersion, status: 'published' },
    { versionId: 9, versionNo: 1, status: 'published' }
  ]);
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
      onVersionChange={onVersionChange}
      onSave={vi.fn()}
      onImport={vi.fn()}
      onEvaluate={vi.fn()}
      onPublish={vi.fn()}
    />,
    {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    }
  );
}

describe('work calendar version view', () => {
  it('defaults to the active snapshot and falls back to the draft', () => {
    expect(resolveWorkCalendarViewMode(detail)).toBe('active');
    expect(resolveWorkCalendarViewMode({ ...detail, activeVersion: undefined })).toBe('draft');
    expect(resolveWorkCalendarViewMode(detail, 'draft')).toBe('draft');
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
        onVersionChange={vi.fn()}
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
    const onVersionChange = vi.fn();
    const rendered = renderHeader({
      dirty: false,
      viewMode: 'draft',
      onViewModeChange,
      onVersionChange
    });

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '历史版本' }));
    await user.click(await screen.findByRole('option', { name: 'v2 生效' }));
    expect(onVersionChange).toHaveBeenCalledWith(10);

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
        onVersionChange={vi.fn()}
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
  it('lists historical versions and selects their IDs', async () => {
    const user = userEvent.setup();
    const onVersionChange = vi.fn();
    renderHeader({ dirty: false, viewMode: 'active', onVersionChange });
    await user.click(screen.getByRole('button', { name: '历史版本' }));
    expect(await screen.findByText('历史发布')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'v2 生效' }).querySelector('[aria-hidden="true"]')
    ).not.toHaveClass('[&_svg]:invisible');
    await user.click(screen.getByRole('option', { name: 'v1 历史发布' }));
    expect(onVersionChange).toHaveBeenCalledWith(9);
  });

  it('blocks version selection while a draft has unsaved changes', async () => {
    const user = userEvent.setup();
    renderHeader({ dirty: true, viewMode: 'draft' });
    await user.click(screen.getByRole('button', { name: '历史版本' }));
    expect(await screen.findByRole('option', { name: 'v1 历史发布' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('option', { name: 'v2 生效' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('searches versions, selects with the keyboard and resets search after closing', async () => {
    const user = userEvent.setup();
    const onVersionChange = vi.fn();
    renderHeader({ dirty: false, viewMode: 'active', onVersionChange });
    const trigger = screen.getByRole('button', { name: '历史版本' });
    expect(trigger).toHaveClass('data-table-filter-control', 'border-dashed');
    await user.click(trigger);
    const input = await screen.findByPlaceholderText('搜索版本号、状态或操作人');
    await user.type(input, 'v1');
    expect(await screen.findByRole('option', { name: 'v1 历史发布' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'v2 生效' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(onVersionChange).toHaveBeenCalledWith(9));
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(await screen.findByPlaceholderText('搜索版本号、状态或操作人')).toHaveValue('');
    expect(await screen.findByRole('option', { name: 'v2 生效' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('only allows editing the current draft when browsing by version ID', () => {
    expect(
      resolveWorkCalendarViewMode(
        {
          ...detail,
          selectedVersion: {
            versionId: 9,
            versionNo: 1,
            status: 'published'
          }
        },
        'history'
      )
    ).toBe('history');
    expect(
      resolveWorkCalendarViewMode({ ...detail, selectedVersion: detail.activeVersion }, 'history')
    ).toBe('active');
    expect(
      resolveWorkCalendarViewMode(
        {
          ...detail,
          selectedVersion: {
            ...detail.draftVersion,
            status: 'draft'
          }
        },
        'history'
      )
    ).toBe('draft');
  });
});

vi.mock('@/hooks/use-dict', () => ({
  useDict: () => ({
    getLabel: (code: string) =>
      ({
        draft: '草稿',
        published: '已发布',
        saved_draft: '已保存草稿',
        published_snapshot: '已发布快照'
      })[code] ?? code
  })
}));
