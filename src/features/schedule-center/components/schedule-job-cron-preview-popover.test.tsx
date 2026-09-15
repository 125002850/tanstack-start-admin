import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleJobCronPreviewPopover } from './schedule-job-cron-preview-popover';
import { ScheduleJobFormSheet } from './schedule-job-form-sheet';

const mockMutateFn = vi.fn();

vi.mock('@/lib/api/clients/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/clients/service')>();
  return {
    ...actual,
    systemScheduleJobNextExecutionsMutationOptions: () => ({
      mutationKey: ['mock', 'next-executions'],
      mutationFn: mockMutateFn
    }),
    systemScheduleJobCreateMutationOptions: () => ({
      mutationKey: ['mock', 'create'],
      mutationFn: vi.fn()
    }),
    systemScheduleJobUpdateMutationOptions: () => ({
      mutationKey: ['mock', 'update'],
      mutationFn: vi.fn()
    })
  };
});

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

describe('ScheduleJobCronPreviewPopover', () => {
  beforeEach(() => {
    mockMutateFn.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders preview trigger button', () => {
    render(<ScheduleJobCronPreviewPopover cronExpression='0 0/5 * * * ?' />, {
      wrapper: createWrapper()
    });

    expect(screen.getByRole('button', { name: '查看接下来 5 次执行时间' })).toBeInTheDocument();
  });

  it('shows empty prompt when cron expression is not provided', async () => {
    const user = userEvent.setup();
    render(<ScheduleJobCronPreviewPopover cronExpression='' />, {
      wrapper: createWrapper()
    });

    await user.click(screen.getByRole('button', { name: '查看接下来 5 次执行时间' }));

    expect(await screen.findByText('请先输入有效的 Cron 表达式')).toBeInTheDocument();
    expect(mockMutateFn).not.toHaveBeenCalled();
  });

  it('fetches and displays next 5 execution times when valid cron is provided', async () => {
    const user = userEvent.setup();
    mockMutateFn.mockResolvedValueOnce([
      '2026-09-08 14:15:00',
      '2026-09-08 14:20:00',
      '2026-09-08 14:25:00',
      '2026-09-08 14:30:00',
      '2026-09-08 14:35:00'
    ]);

    render(<ScheduleJobCronPreviewPopover cronExpression='0 0/5 * * * ?' />, {
      wrapper: createWrapper()
    });

    await user.click(screen.getByRole('button', { name: '查看接下来 5 次执行时间' }));

    await waitFor(() => {
      expect(mockMutateFn).toHaveBeenCalled();
      expect(mockMutateFn.mock.calls[0][0]).toEqual({
        cronExpression: '0 0/5 * * * ?',
        count: 5
      });
    });

    expect(await screen.findByText('2026-09-08 14:15:00')).toBeInTheDocument();
    expect(screen.getByText('2026-09-08 14:20:00')).toBeInTheDocument();
    expect(screen.getByText('2026-09-08 14:25:00')).toBeInTheDocument();
    expect(screen.getByText('2026-09-08 14:30:00')).toBeInTheDocument();
    expect(screen.getByText('2026-09-08 14:35:00')).toBeInTheDocument();
    expect(screen.getByText('第 1 次')).toBeInTheDocument();
    expect(screen.getByText('第 5 次')).toBeInTheDocument();
  });

  it('shows error message when calculation fails', async () => {
    const user = userEvent.setup();
    mockMutateFn.mockRejectedValueOnce(new Error('Cron 表达式格式无效'));

    render(<ScheduleJobCronPreviewPopover cronExpression='invalid-cron' />, {
      wrapper: createWrapper()
    });

    await user.click(screen.getByRole('button', { name: '查看接下来 5 次执行时间' }));

    expect(await screen.findByText('表达式格式错误，无法计算执行时间')).toBeInTheDocument();
  });
});

describe('ScheduleJobFormSheet with Cron Preview integration', () => {
  beforeEach(() => {
    mockMutateFn.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('allows clicking preview button in edit form for 当前 Cron', async () => {
    const user = userEvent.setup();
    mockMutateFn.mockResolvedValueOnce([
      '2026-09-08 15:00:00',
      '2026-09-08 16:00:00',
      '2026-09-08 17:00:00',
      '2026-09-08 18:00:00',
      '2026-09-08 19:00:00'
    ]);

    const editingRecord = {
      id: 1,
      jobName: '测试任务',
      jobCode: 'testJob',
      defaultCron: '0 0 * * * ?',
      cronExpression: '0 0 * * * ?',
      invokeRoute: 'bean://test.run',
      groupName: '测试分组',
      status: 'enable',
      remark: '测试备注'
    };

    render(
      <ScheduleJobFormSheet
        open={true}
        onOpenChange={vi.fn()}
        editingRecord={
          editingRecord as unknown as Parameters<typeof ScheduleJobFormSheet>[0]['editingRecord']
        }
      />,
      { wrapper: createWrapper() }
    );

    const previewButtons = screen.getAllByRole('button', {
      name: '查看接下来 5 次执行时间'
    });
    expect(previewButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(previewButtons[0]);

    await waitFor(() => {
      expect(mockMutateFn).toHaveBeenCalled();
      expect(mockMutateFn.mock.calls[0][0]).toEqual({
        cronExpression: '0 0 * * * ?',
        count: 5
      });
    });

    expect(await screen.findByText('2026-09-08 15:00:00')).toBeInTheDocument();
  });
});
