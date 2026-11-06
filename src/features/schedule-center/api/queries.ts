import { queryOptions } from '@tanstack/react-query';
import { systemScheduleJobExecutionLogs } from '@/lib/api/clients/service';

export function scheduleExecutionLogsQueryOptions(jobId?: number) {
  return queryOptions({
    queryKey: ['service', 'schedule-job', 'execution-logs', { jobId }] as const,
    queryFn: ({ signal }) =>
      jobId == null ? Promise.resolve([]) : systemScheduleJobExecutionLogs({ jobId }, { signal })
  });
}
