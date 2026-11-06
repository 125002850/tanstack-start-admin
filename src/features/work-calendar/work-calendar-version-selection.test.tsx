import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import type {
  WorkCalendarYearDetailReqDTO,
  WorkCalendarVersionDetailReqDTO,
  WorkCalendarYearDetailRspDTO
} from '@/lib/api/clients/service';
import WorkCalendarPage from './work-calendar-page';

const api = vi.hoisted(() => ({
  year: vi.fn(),
  version: vi.fn(),
  save: vi.fn(),
  importDraft: vi.fn(),
  list: vi.fn(),
  evaluate: vi.fn()
}));
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
    saveWorkCalendarDraftMutationOptions: () => ({ mutationFn: api.save }),
    importWorkCalendarDraftMutationOptions: () => ({ mutationFn: api.importDraft }),
    evaluateWorkCalendarVersionMutationOptions: () => ({ mutationFn: api.evaluate })
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
  lockVersion: 4,
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
  lockVersion: 2,
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
function renderPage(year = 2026) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <WorkCalendarPage year={year} onYearChange={vi.fn()} />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(toast, 'warning');
  Element.prototype.scrollIntoView ??= vi.fn();
  api.year.mockImplementation(async (request: WorkCalendarYearDetailReqDTO) =>
    request.view === 'active' ? detail('09:00', active) : detail('10:00')
  );
  api.version.mockResolvedValue(detail('08:00', historical));
  api.list.mockResolvedValue([draft, active, historical]);
  api.evaluate.mockResolvedValue({
    working: true,
    classification: 'working_time'
  });
});
afterEach(cleanup);

it.each(['inherited', 'empty'] as const)(
  'saves a new year with %s standard periods before importing JSON',
  async (configuration) => {
    const user = userEvent.setup();
    const standardPeriods = [{ start: '09:00', end: '12:00' }];
    const initial: WorkCalendarYearDetailRspDTO = {
      year: 2027,
      viewBasis: 'weekly_fallback',
      standardPeriods: configuration === 'inherited' ? standardPeriods : [],
      dateOverrides: [],
      resolvedDays: []
    };
    const saved: WorkCalendarYearDetailRspDTO = {
      ...initial,
      viewBasis: 'saved_draft',
      draftVersion: { ...draft, versionNo: 1 },
      selectedVersion: { ...draft, versionNo: 1 },
      standardPeriods
    };
    api.year.mockResolvedValue(initial);
    api.save.mockResolvedValue(saved);
    api.importDraft.mockResolvedValue(saved);
    renderPage(2027);
    await screen.findByText('首次配置');

    const saveButton = screen.getByRole('button', { name: '保存草稿' });
    await user.click(screen.getByRole('button', { name: '导入 JSON' }));
    expect(toast.warning).toHaveBeenCalledWith(
      '首次配置需先添加标准工作时段并保存草稿，再进行导入。'
    );
    expect(screen.queryByRole('dialog', { name: '覆盖导入特殊日期' })).not.toBeInTheDocument();

    if (configuration === 'empty') {
      await user.click(saveButton);
      expect(screen.getByText('草稿尚未保存：至少配置一个标准工作时段')).toBeInTheDocument();
      expect(api.save).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: '添加时段' }));
    }
    await user.click(saveButton);
    await screen.findByText('草稿 v1');
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0][0]).toEqual({
      year: 2027,
      draftVersionId: undefined,
      expectedLockVersion: undefined,
      standardPeriods,
      dateOverrides: []
    });
    expect(screen.queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '导入 JSON' }));
    await screen.findByRole('dialog', { name: '覆盖导入特殊日期' });
    const file = new File(
      [JSON.stringify({ schemaVersion: 1, year: 2027, dateOverrides: [] })],
      'work-calendar-2027.json',
      { type: 'application/json' }
    );
    await user.upload(screen.getByLabelText('选择工作日历 JSON 文件'), file);
    await user.click(screen.getByRole('button', { name: '确认覆盖特殊日期' }));
    await waitFor(() => expect(api.importDraft).toHaveBeenCalledTimes(1));
    expect(api.importDraft.mock.calls[0][0]).toEqual({
      params: { year: 2027, draftVersionId: draft.versionId, expectedLockVersion: 0 },
      body: { file }
    });
  }
);

it.each([
  ['生效', active],
  ['草稿', draft],
  ['历史', historical]
] as const)(
  'evaluates the selected %s version with its own ID and lock version',
  async (mode, version) => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('生效 v2');
    if (mode === '草稿') {
      await user.click(screen.getByRole('button', { name: '编辑草稿' }));
    } else if (mode === '历史') {
      await user.click(screen.getByRole('button', { name: '历史版本' }));
      await user.click(await screen.findByRole('option', { name: 'v1 历史发布' }));
    }
    await screen.findByText(`${mode} v${version.versionNo}`);
    await user.click(screen.getByRole('button', { name: '试算' }));
    expect(await screen.findByRole('dialog', { name: '试算' })).toHaveTextContent(
      `使用当前查看的 2026 年 v${version.versionNo} 版本`
    );
    fireEvent.change(screen.getByLabelText('试算时间'), { target: { value: '2026-01-05T09:30' } });
    await user.click(screen.getByRole('button', { name: '开始试算' }));

    await screen.findByText('处于工作时间');
    expect(api.evaluate).toHaveBeenCalledTimes(1);
    expect(api.evaluate.mock.calls[0][0]).toEqual({
      versionId: version.versionId,
      expectedLockVersion: version.lockVersion,
      localDateTime: '2026-01-05 09:30:00'
    });
    expect(api.save).not.toHaveBeenCalled();
  }
);

it('requires saving unsaved draft changes before evaluating the selected version', async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole('button', { name: '编辑草稿' }));
  await screen.findByText('草稿 v3');
  fireEvent.change(screen.getByLabelText('第 1 个标准时段开始时间'), {
    target: { value: '11:00' }
  });
  await user.click(screen.getByRole('button', { name: '试算' }));

  expect(toast.warning).toHaveBeenCalledWith('试算只使用当前版本已保存的规则，请先保存当前修改。');
  expect(screen.queryByRole('dialog', { name: '试算' })).not.toBeInTheDocument();
  expect(api.evaluate).not.toHaveBeenCalled();
});

it('keeps the evaluation entry visible and explains when no saved version exists', async () => {
  const user = userEvent.setup();
  api.year.mockResolvedValue({
    ...detail('10:00'),
    activeVersion: undefined,
    draftVersion: undefined,
    selectedVersion: undefined
  });
  renderPage();
  await user.click(await screen.findByRole('button', { name: '试算' }));

  expect(toast.warning).toHaveBeenCalledWith('当前没有已保存的版本，请先保存草稿后再试算。');
  expect(api.evaluate).not.toHaveBeenCalled();
});

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
  DictionaryScope: ({ children }: { children: React.ReactNode }) => children,
  DictText: ({ value }: { value: string }) => value
}));
