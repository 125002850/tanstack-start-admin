import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { nullableDateTime } from '@/lib/formatters/display';
import type { ScheduleJobExecutionLogRspDTO } from '@/lib/api/clients/service';
import { executionDuration, executionStatusLabel, executionStatusVariant } from '../lib/execution';

export function ScheduleExecutionSummary({
  execution,
  onView
}: {
  execution?: ScheduleJobExecutionLogRspDTO;
  onView: () => void;
}) {
  if (!execution) return <span className='text-muted-foreground'>暂无执行</span>;
  return (
    <div className='flex min-w-0 flex-col gap-1 py-1'>
      <div className='flex items-center gap-2'>
        <Badge variant={executionStatusVariant(execution.status)}>
          {execution.status === 'running' ? <Icons.spinner className='animate-spin' /> : null}
          {executionStatusLabel(execution.status)}
        </Badge>
        <span className='truncate text-xs text-muted-foreground'>
          {executionDuration(execution)}
        </span>
      </div>
      <Button
        variant='link'
        size='sm'
        className='h-auto justify-start p-0'
        onClick={onView}
        aria-label='查看最近执行记录'
      >
        {nullableDateTime(execution.startTime)}
      </Button>
    </div>
  );
}
