import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  WorkCalendarYearDetailReqDTO,
  WorkCalendarVersionDetailReqDTO,
  WorkCalendarYearDetailRspDTO
} from '@/lib/api/clients/service';
import WorkCalendarPage from './work-calendar-page';

const api = vi.hoisted(() => ({ year: vi.fn(), version: vi.fn(), save: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/api/clients/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/clients/service')>();
  return {
    ...actual,
    fetchWorkCalendarYearDetailQueryOptions: (request: WorkCalendarYearDetailReqDTO) => ({
      ...actual.fetchWorkCalendarYearDetailQueryOptions(request),
      queryFn: () => api.year(request)
    }),
    fetchWorkCalendarVersionDetailQueryOptions: (request: WorkCalendarVersionDetailReqDTO) => ({
      ...actual.fetchWorkCalendarVersionDetailQueryOptions(request),
      queryFn: () => api.version(request)
    }),
    listWorkCalendarVersionsQueryOptions: (request: { year: number }) => ({
      ...actual.listWorkCalendarVersionsQueryOptions(request),
      queryFn: () => api.list(request)
    }),
    saveWorkCalendarDraftMutationOptions: () => ({ mutationFn: api.save })
  };
});
vi.mock('./hooks/use-work-calendar-dirty-guard', () => ({
  useWorkCalendarDirtyGuard: () => ({
    confirmOpen: false,
    cancelDiscard: vi.fn(),
    confirmDiscard: vi.fn()
  })
}));

const active = {
  versionId: 2,
  versionNo: 2,
  status: 'published'
} as const;
const draft = {
  versionId: 3,
  versionNo: 3,
  lockVersion: 0,
  status: 'draft'
} as const;
const historical = {
  versionId: 1,
  versionNo: 1,
  status: 'published'
} as const;
function detail(
  start: string,
  selectedVersion = draft as WorkCalendarYearDetailRspDTO['selectedVersion']
): WorkCalendarYearDetailRspDTO {
  return {
    year: 2026,
    activeVersion: active,
    draftVersion: draft,
    selectedVersion,
    standardPeriods: [{ start, end: '18:00' }],
    dateOverrides: [],
    resolvedDays: []
  };
}
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <WorkCalendarPage year={2026} onYearChange={vi.fn()} />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView ??= vi.fn();
  api.year.mockImplementation(async (request: WorkCalendarYearDetailReqDTO) =>
    request.view === 'active' ? detail('09:00', active) : detail('10:00')
  );
  api.version.mockResolvedValue(detail('08:00', historical));
  api.list.mockResolvedValue([draft, active, historical]);
});
afterEach(cleanup);

it('searches by publisher and preserves the version status and publication details', async () => {
  const user = userEvent.setup();
  api.list.mockResolvedValue([
    draft,
    active,
    {
      ...historical,
      publishedAt: '2026-09-01T10:00:00+08:00',
      publishedByName: '发布人甲',
      updatedAt: '2026-09-02 12:34:56',
      updatedByName: '更新人乙'
    }
  ]);
  renderPage();
  await screen.findByText('当前生效快照（只读）');
  await user.click(screen.getByRole('button', { name: '历史版本' }));
  await user.type(await screen.findByPlaceholderText('搜索版本号、状态或操作人'), '发布人甲');

  const option = await screen.findByRole('option', { name: /v1 历史发布.*发布人甲/u });
  expect(option.querySelector('[data-slot="badge"]')).toHaveTextContent('历史发布');
  expect(option).toHaveTextContent('2026-09-01');
  expect(option).not.toHaveTextContent('2026-09-02');
  expect(option).not.toHaveTextContent('更新人乙');
  expect(screen.queryByRole('option', { name: 'v2 生效' })).not.toBeInTheDocument();
  await user.click(option);

  await screen.findByText('历史版本快照（只读）');
  expect(api.version).toHaveBeenCalledWith({ year: 2026, versionId: 1 });
});

it('shows the draft update time and updater and supports searching by updater', async () => {
  const user = userEvent.setup();
  api.list.mockResolvedValue([
    { ...draft, updatedAt: '2026-09-30 12:34:56', updatedByName: '更新人甲' },
    active,
    historical
  ]);
  renderPage();
  await screen.findByText('当前生效快照（只读）');
  await user.click(screen.getByRole('button', { name: '历史版本' }));

  const option = await screen.findByRole('option', { name: /v3 草稿.*更新人甲/u });
  expect(option).toHaveTextContent('2026-09-30 12:34:56 · 更新人甲');
  await user.type(screen.getByPlaceholderText('搜索版本号、状态或操作人'), '更新人甲');
  expect(screen.getByRole('option', { name: /v3 草稿.*更新人甲/u })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'v2 生效' })).not.toBeInTheDocument();
});

it('retries a failed version list without changing the selected version', async () => {
  const user = userEvent.setup();
  api.list.mockRejectedValueOnce(new Error('版本列表加载失败'));
  renderPage();
  await screen.findByText('当前生效快照（只读）');
  await user.click(screen.getByRole('button', { name: '历史版本' }));
  await user.click(await screen.findByRole('button', { name: '重新加载版本' }));

  const selected = await screen.findByRole('option', { name: 'v2 生效' });
  expect(api.list).toHaveBeenCalledTimes(2);
  await user.click(selected);

  expect(api.version).not.toHaveBeenCalled();
  expect(screen.queryByPlaceholderText('搜索版本号、状态或操作人')).not.toBeInTheDocument();
});

it('loads active content by default even when the server default is a draft', async () => {
  renderPage();
  const start = await screen.findByLabelText('第 1 个标准时段开始时间');
  expect(start).toHaveValue('09:00');
  expect(start).toBeDisabled();
  expect(api.year).toHaveBeenCalledWith({ year: 2026, view: 'active' });
  expect(screen.getByRole('button', { name: '历史版本' })).toHaveTextContent('v2');
  expect(api.list).not.toHaveBeenCalled();
});

it('falls back to the saved draft when the year has no active version', async () => {
  api.year.mockResolvedValue({ ...detail('10:00'), activeVersion: undefined });
  renderPage();
  const start = await screen.findByLabelText('第 1 个标准时段开始时间');
  expect(start).toHaveValue('10:00');
  expect(start).toBeEnabled();
  expect(api.year).not.toHaveBeenCalledWith({ year: 2026, view: 'active' });
  expect(screen.getByRole('button', { name: '历史版本' })).toHaveTextContent('v3');
  expect(api.list).not.toHaveBeenCalled();
});

it('switches to historical content read-only and can return to editing the draft', async () => {
  const user = userEvent.setup();
  const rendered = renderPage();
  await screen.findByText('当前生效快照（只读）');
  await user.click(screen.getByRole('button', { name: '历史版本' }));
  await user.click(await screen.findByRole('option', { name: 'v1 历史发布' }));
  await screen.findByText('历史版本快照（只读）');
  expect(api.version).toHaveBeenCalledWith({ year: 2026, versionId: 1 });
  expect(screen.getByLabelText('第 1 个标准时段开始时间')).toHaveValue('08:00');
  expect(screen.getByLabelText('第 1 个标准时段开始时间')).toBeDisabled();
  expect(screen.getByRole('button', { name: '历史版本' })).toHaveTextContent('v1');
  fireEvent.submit(rendered.container.querySelector('form')!);
  await waitFor(() => expect(api.save).not.toHaveBeenCalled());
  await user.click(screen.getByRole('button', { name: '编辑草稿' }));
  await waitFor(() =>
    expect(screen.getByLabelText('第 1 个标准时段开始时间')).toHaveValue('10:00')
  );
  expect(screen.getByLabelText('第 1 个标准时段开始时间')).toBeEnabled();
  expect(screen.getByRole('button', { name: '历史版本' })).toHaveTextContent('v3');
});

it('refreshes a previously viewed draft after saving through the editor', async () => {
  const user = userEvent.setup();
  let saved = detail('10:00');
  api.year.mockImplementation(async (request: WorkCalendarYearDetailReqDTO) =>
    request.view === 'active' ? detail('09:00', active) : saved
  );
  api.version.mockImplementation(async ({ versionId }: WorkCalendarVersionDetailReqDTO) =>
    versionId === 3 ? saved : detail('09:00', active)
  );
  api.save.mockImplementation(async () => {
    saved = detail('11:00');
    return saved;
  });
  renderPage();
  await screen.findByText('当前生效快照（只读）');
  await user.click(screen.getByRole('button', { name: '历史版本' }));
  await user.click(await screen.findByRole('option', { name: 'v3 草稿' }));
  await waitFor(() => expect(screen.getByLabelText('第 1 个标准时段开始时间')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('第 1 个标准时段开始时间'), {
    target: { value: '11:00' }
  });
  await user.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument()
  );
  await user.click(screen.getByRole('button', { name: '历史版本' }));
  await user.click(await screen.findByRole('option', { name: 'v2 生效' }));
  await screen.findByText('当前生效快照（只读）');
  await user.click(screen.getByRole('button', { name: '历史版本' }));
  await user.click(await screen.findByRole('option', { name: 'v3 草稿' }));
  await waitFor(() =>
    expect(screen.getByLabelText('第 1 个标准时段开始时间')).toHaveValue('11:00')
  );
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

vi.mock('@/components/dictionary/dictionary-scope', () => ({
  DictionaryScope: ({ children }: { children: React.ReactNode }) => children
}));
