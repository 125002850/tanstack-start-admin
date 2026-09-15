import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  systemScheduleJobPageQueryOptions: vi.fn(),
  mutationOptions: vi.fn(() => ({ mutationFn: vi.fn() }))
}));

vi.mock('@/lib/api/clients/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/clients/service')>();
  return {
    ...actual,
    systemDictGlobalItemsOptions: async () => [
      {
        dictTypeCode: 'ENABLE_STATUS',
        items: [
          { code: 'enable', name: '启用', status: 'enable' },
          { code: 'disable', name: '禁用', status: 'enable' }
        ]
      }
    ],
    systemScheduleJobPageQueryOptions: (...args: unknown[]) =>
      serviceMocks.systemScheduleJobPageQueryOptions(...args),
    systemScheduleJobEnableMutationOptions: serviceMocks.mutationOptions,
    systemScheduleJobDisableMutationOptions: serviceMocks.mutationOptions,
    systemScheduleJobDeleteMutationOptions: serviceMocks.mutationOptions,
    systemScheduleJobTriggerMutationOptions: serviceMocks.mutationOptions
  };
});

import ScheduleCenterManagementPage from './schedule-center-management-page';

interface SchedulePageRequest {
  pageNo: number;
  pageSize: number;
  condition?: unknown;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ScheduleCenterManagementPage', () => {
  const requests: SchedulePageRequest[] = [];

  beforeEach(() => {
    requests.length = 0;
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    serviceMocks.mutationOptions.mockClear();
    serviceMocks.systemScheduleJobPageQueryOptions
      .mockReset()
      .mockImplementation((request: SchedulePageRequest) => {
        requests.push(request);
        return queryOptions({
          queryKey: ['schedule-center-test', request],
          queryFn: async () => ({ total: 0, list: [] })
        });
      });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('serializes status as the backend enum condition node', async () => {
    const user = userEvent.setup();
    render(<ScheduleCenterManagementPage />, { wrapper: createWrapper() });

    await screen.findByRole('heading', { name: '暂无定时任务' });
    await user.click(screen.getByRole('button', { name: '状态' }));
    await user.click(await screen.findByRole('option', { name: '启用' }));

    await waitFor(() => {
      expect(requests.at(-1)?.condition).toEqual({
        nodeType: 'compose',
        logic: 'AND',
        children: [{ nodeType: 'enum', field: 'status', op: 'EQ', value: 'enable' }]
      });
    });
  });

  it('立即触发操作弹出二次确认框，确认后才调用触发 mutation', async () => {
    const user = userEvent.setup();
    const triggerFn = vi.fn().mockResolvedValue({});
    serviceMocks.mutationOptions.mockReturnValue({
      mutationFn: triggerFn
    });

    serviceMocks.systemScheduleJobPageQueryOptions.mockImplementation(() =>
      queryOptions({
        queryKey: ['schedule-center-trigger-test'],
        queryFn: async () => ({
          total: 1,
          list: [
            {
              id: 101,
              jobCode: 'JOB_SYNC',
              jobName: '数据同步任务',
              status: 'enable',
              cron: '0 0 * * * ?',
              executorName: 'syncExecutor'
            }
          ]
        })
      })
    );

    render(<ScheduleCenterManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('数据同步任务')).toBeInTheDocument());

    const triggerBtn = screen.getByRole('button', { name: '立即触发' });
    expect(triggerBtn).toBeInTheDocument();
    await user.click(triggerBtn);

    expect(triggerFn).not.toHaveBeenCalled();
    expect(await screen.findByText('确认立即触发任务？')).toBeInTheDocument();
    expect(screen.getByText('确定要立即触发一次定时任务【数据同步任务】吗？')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: '立即执行' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(triggerFn).toHaveBeenCalledWith({ id: 101 }, expect.anything());
    });
  });
});
