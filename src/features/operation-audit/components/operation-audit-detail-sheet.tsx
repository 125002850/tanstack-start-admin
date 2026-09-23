import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useDict } from '@/hooks/use-dict';
import {
  detailOperationAuditLogQueryOptions,
  type OperationAuditLogRspDTO
} from '@/lib/api/clients/service';
import { nullableDateTime, nullableOperatorLabel, nullableText } from '@/lib/formatters/display';

import { operationAuditEnumCode, operationAuditEnumLabel } from '../operation-audit-enum';

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  const displayValue = value === null || value === undefined || value === '' ? '-' : value;

  return (
    <div className='grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='min-w-0 break-all'>{displayValue}</span>
    </div>
  );
}

function prettyJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return trimmed || '-';

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return value;
  }
}

export function formatOperationAuditRequestParams(value: string | undefined) {
  if (!value) return '-';

  const bodyMarker = '\nbody=';
  if (value.startsWith('query=') && value.includes(bodyMarker)) {
    const markerIndex = value.indexOf(bodyMarker);
    const query = value.slice('query='.length, markerIndex);
    const body = value.slice(markerIndex + bodyMarker.length);
    return `query=${prettyJson(query)}\nbody=${prettyJson(body)}`;
  }

  return prettyJson(value);
}

interface OperationAuditDetailSheetProps {
  data: OperationAuditLogRspDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OperationAuditDetailSheet({
  data,
  open,
  onOpenChange
}: OperationAuditDetailSheetProps) {
  const logId = data.logId ?? 0;
  const actionDictionary = useDict('OPERATION_AUDIT_ACTION');
  const statusDictionary = useDict('OPERATION_AUDIT_STATUS');
  const detailQuery = useQuery({
    ...detailOperationAuditLogQueryOptions({ logId }),
    enabled: open && logId > 0
  });
  const detail = detailQuery.data;
  const action = detail?.action ?? data.action;
  const status = detail?.resultStatus ?? data.resultStatus;
  const actionCode = operationAuditEnumCode(action);
  const statusCode = operationAuditEnumCode(status);
  const failed = statusCode === 'failed';
  const operatorLabel = nullableOperatorLabel({
    id: detail?.operatorId ?? data.operatorId,
    name: detail?.operatorName ?? data.operatorName,
    username: detail?.operatorUsername,
    realName: detail?.operatorRealName
  });
  const operatorUsername = detail?.operatorUsername;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full max-w-2xl flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>操作日志详情</SheetTitle>
          <SheetDescription>查看本次 API 操作的请求上下文、审计结果和链路信息。</SheetDescription>
        </SheetHeader>

        <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1'>
          {detailQuery.isPending ? (
            <div className='text-muted-foreground flex items-center gap-2 py-8 text-sm'>
              <Icons.spinner className='size-4 animate-spin' /> 正在加载详情
            </div>
          ) : null}

          {detailQuery.isError ? (
            <Alert variant='destructive'>
              <Icons.alertCircle />
              <AlertTitle>详情加载失败</AlertTitle>
              <AlertDescription>请关闭后重试，或刷新操作日志列表。</AlertDescription>
            </Alert>
          ) : null}

          {detail ? (
            <>
              <div className='grid gap-3 rounded-lg border p-4 sm:grid-cols-2'>
                <DetailItem label='日志 ID' value={nullableText(detail.logId)} />
                <DetailItem label='操作时间' value={nullableDateTime(detail.operationTime)} />
                <DetailItem label='模块' value={nullableText(detail.moduleName)} />
                <DetailItem label='模块编码' value={nullableText(detail.moduleCode)} />
                <DetailItem
                  label='动作'
                  value={actionDictionary.getLabel(actionCode) ?? operationAuditEnumLabel(action)}
                />
                <DetailItem
                  label='状态'
                  value={
                    <Badge
                      variant={
                        failed ? 'destructive' : statusCode === 'success' ? 'success' : 'outline'
                      }
                    >
                      {statusDictionary.getLabel(statusCode) ?? operationAuditEnumLabel(status)}
                    </Badge>
                  }
                />
                <DetailItem label='操作描述' value={nullableText(detail.description)} />
                <DetailItem label='耗时' value={`${detail.durationMs ?? 0} ms`} />
                <DetailItem label='操作人' value={operatorLabel} />
                <DetailItem label='操作人账号' value={nullableText(operatorUsername)} />
                <DetailItem label='客户端 IP' value={nullableText(detail.clientIp)} />
                <DetailItem label='Trace ID' value={nullableText(detail.traceId)} />
                <DetailItem
                  label='请求路径'
                  value={`${detail.requestMethod ?? '-'} ${detail.requestPath ?? '-'}`}
                />
                <DetailItem label='HTTP 状态' value={nullableText(detail.httpStatus)} />
                <DetailItem label='业务状态码' value={nullableText(detail.resultCode)} />
              </div>

              {failed ? (
                <Alert variant='destructive'>
                  <Icons.alertCircle />
                  <AlertTitle>操作失败</AlertTitle>
                  <AlertDescription className='break-all whitespace-pre-wrap'>
                    {nullableText(detail.errorMessage)}
                  </AlertDescription>
                </Alert>
              ) : null}

              <section className='space-y-2'>
                <h3 className='text-sm font-medium'>请求参数（已脱敏）</h3>
                <pre className='bg-muted/40 max-h-96 overflow-auto rounded-lg border p-4 font-mono text-xs leading-5 break-all whitespace-pre-wrap'>
                  {formatOperationAuditRequestParams(detail.requestParams)}
                </pre>
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
