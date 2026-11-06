import type { ScheduleJobExecutionLogRspDTO } from '@/lib/api/clients/service';

export function executionStatusLabel(status?: string) {
  switch (status) {
    case 'running':
      return '执行中';
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    default:
      return status || '—';
  }
}

export function executionStatusVariant(status?: string) {
  switch (status) {
    case 'running':
      return 'info';
    case 'success':
      return 'success';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function executionDuration(execution: ScheduleJobExecutionLogRspDTO) {
  const millis = execution.durationMillis;
  if (millis == null || !Number.isFinite(millis) || millis < 0) return '—';
  const seconds = Math.floor(millis / 1000);
  const duration =
    seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  return `${execution.status === 'running' ? '已运行' : '耗时'} ${duration}`;
}

export function executionPollInterval(
  executions: Array<ScheduleJobExecutionLogRspDTO | undefined> | undefined,
  triggeredAt = 0,
  now = Date.now()
) {
  const justTriggered = triggeredAt > 0 && now - triggeredAt < 30_000;
  return justTriggered || executions?.some((execution) => execution?.status === 'running')
    ? 3_000
    : 15_000;
}
