import { queryOptions } from '@tanstack/react-query';
import { systemScheduleJobExecutionLogs, scheduleJobRequestLogs } from '@/lib/api/clients/service';

export function scheduleExecutionLogsQueryOptions(jobId?: number) {
  return queryOptions({
    queryKey: ['service', 'schedule-job', 'execution-logs', { jobId }] as const,
    queryFn: ({ signal }) =>
      jobId == null ? Promise.resolve([]) : systemScheduleJobExecutionLogs({ jobId }, { signal })
  });
}

export function scheduleRequestLogsQueryOptions(jobId: number, executionId: number) {
  return queryOptions({
    queryKey: ['service', 'schedule-job', 'request-logs', { jobId, executionId }] as const,
    queryFn: ({ signal }) => scheduleJobRequestLogs({ jobId, executionId }, { signal })
  });
}
