import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
const JsonOutputPreview = lazy(() =>
  import('@/components/json/json-output-preview').then((module) => ({
    default: module.JsonOutputPreview
  }))
);
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { SILENT_QUERY_META } from '@/lib/query-client';
import { formatJsonSource } from '@/lib/json-source';
import { nullableDateTime } from '@/lib/formatters/display';
import { scheduleRequestLogsQueryOptions } from '../api/queries';

export function ScheduleJobRequestLogs({
  jobId,
  executionId
}: {
  readonly jobId: number;
  readonly executionId: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className='mt-2'>
      <CollapsibleTrigger asChild>
        <Button variant='outline' size='sm'>
          {open ? '收起请求报文' : '查看请求报文'}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='pt-3'>
        {open ? <RequestLogContent jobId={jobId} executionId={executionId} /> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function RequestLogContent({ jobId, executionId }: { jobId: number; executionId: number }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    ...scheduleRequestLogsQueryOptions(jobId, executionId),
    refetchInterval: (query) =>
      query.state.data?.available && !query.state.data.completed ? 3000 : false,
    refetchIntervalInBackground: false,
    meta: SILENT_QUERY_META
  });

  if (isError) {
    return (
      <div role='alert' className='flex items-center gap-2 text-sm text-destructive'>
        <span>{normalizeApiError(error, { fallbackMessage: '请求报文加载失败' }).message}</span>
        <Button variant='outline' size='sm' onClick={() => void refetch()}>
          重试
        </Button>
      </div>
    );
  }
  if (isPending) return <p className='text-sm text-muted-foreground'>正在加载请求报文…</p>;
  if (!data?.available) {
    return <p className='text-sm text-muted-foreground'>本次报文未保留或已被新执行覆盖。</p>;
  }
  if (!data.completed) {
    return <p className='text-sm text-muted-foreground'>正在采集请求报文，执行结束后可查看。</p>;
  }

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <p className='text-xs text-muted-foreground'>
        共 {data.totalRequests} 次请求
        {data.omittedRequests > 0
          ? `，${data.omittedRequests} 条超出快照容量，未保留。`
          : '，报文已脱敏；超大正文会标记省略。'}
      </p>
      {data.totalRequests === 0 ? (
        <p className='text-sm text-muted-foreground'>本次执行没有采集到出站请求。</p>
      ) : null}
      <Accordion type='multiple' className='min-w-0'>
        {data.requests.map((request) => (
          <AccordionItem key={request.sequence} value={String(request.sequence)}>
            <AccordionTrigger className='text-xs'>
              <span className='min-w-0 break-all text-left'>
                #{request.sequence} {request.method} · {request.statusCode ?? '未收到响应'} ·{' '}
                {request.durationMillis} ms
                <span className='mt-1 block text-muted-foreground'>{request.url}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className='flex min-w-0 flex-col gap-3'>
              <p className='text-xs text-muted-foreground'>
                {nullableDateTime(request.startTime)}
                {request.errorType ? ` · ${request.errorType}` : ''}
              </p>
              {request.requestParams && request.requestParams !== '-' ? (
                <RequestBody title='请求参数' json={formatBody(request.requestParams)} />
              ) : null}
              <RequestBody title='请求报文' json={formatBody(request.requestBody)} />
              <RequestBody title='返回报文' json={formatBody(request.responseBody)} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function formatBody(value?: string): string {
  if (!value || value === '-') return '（空）';
  try {
    return formatJsonSource(value);
  } catch {
    return value;
  }
}

function RequestBody({ title, json }: { title: string; json: string }) {
  let validJson = false;
  try {
    JSON.parse(json);
    validJson = true;
  } catch {
    /* 明确展示空正文和省略标记。 */
  }
  return (
    <section className='min-w-0'>
      <p className='mb-1 text-xs font-medium'>{title}</p>
      {validJson ? (
        <Suspense fallback={<p className='text-xs text-muted-foreground'>正在加载报文…</p>}>
          <JsonOutputPreview source={json} ariaLabel={title} formatted />
        </Suspense>
      ) : (
        <pre className='overflow-auto whitespace-pre-wrap break-all text-xs'>{json}</pre>
      )}
    </section>
  );
}
