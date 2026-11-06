import * as React from 'react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchLogs = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/clients/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/clients/service')>()),
  systemScheduleJobExecutionLogs: fetchLogs
}));

import { ScheduleJobExecutionLogSheet } from './schedule-job-execution-log-sheet';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('执行记录刷新', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    fetchLogs.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it('执行中自动刷新到最终结果，关闭后停止查询', async () => {
    const execution = { id: 12, startTime: '2026-10-16 10:00:00', durationMillis: 12000 };
    fetchLogs
      .mockResolvedValueOnce([{ ...execution, status: 'running' }])
      .mockResolvedValue([
        { ...execution, status: 'success', endTime: '2026-10-16 10:00:15', durationMillis: 15000 }
      ]);
    const { rerender } = render(
      <ScheduleJobExecutionLogSheet
        job={{ id: 1, jobName: '测试任务' }}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: createWrapper() }
    );
    await advance(1);
    expect(screen.getByText('执行中')).toBeInTheDocument();
    expect(screen.getByText('已运行 12 秒')).toBeInTheDocument();
    await advance(3001);
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.queryByText('执行中')).not.toBeInTheDocument();
    expect(screen.getByText('耗时 15 秒')).toBeInTheDocument();
    expect(fetchLogs).toHaveBeenCalledTimes(2);
    rerender(<ScheduleJobExecutionLogSheet job={{ id: 1 }} open={false} onOpenChange={() => {}} />);
    await advance(30001);
    expect(fetchLogs).toHaveBeenCalledTimes(2);
  });

  it('浏览器隐藏时停止轮询，切换任务不展示上一任务缓存', async () => {
    fetchLogs.mockResolvedValue([{ id: 12, status: 'running', errorMessage: '不应该出现' }]);
    const { rerender } = render(
      <ScheduleJobExecutionLogSheet job={{ id: 1 }} open onOpenChange={() => {}} />,
      { wrapper: createWrapper() }
    );
    await advance(1);
    focusManager.setFocused(false);
    await advance(9000);
    expect(fetchLogs).toHaveBeenCalledTimes(1);
    fetchLogs.mockResolvedValue([]);
    rerender(<ScheduleJobExecutionLogSheet job={{ id: 2 }} open onOpenChange={() => {}} />);
    await advance(1);
    expect(screen.queryByText('执行中')).not.toBeInTheDocument();
    expect(screen.getByText('暂无执行记录')).toBeInTheDocument();
    expect(fetchLogs).toHaveBeenLastCalledWith({ jobId: 2 }, { signal: expect.any(AbortSignal) });
  });

  it('查询失败显示错误而非空记录', async () => {
    fetchLogs.mockRejectedValue(new Error('network failed'));
    render(<ScheduleJobExecutionLogSheet job={{ id: 1 }} open onOpenChange={() => {}} />, {
      wrapper: createWrapper()
    });
    await advance(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.queryByText('暂无执行记录')).not.toBeInTheDocument();
  });
});
