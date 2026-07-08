import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldItem } from '@/components/ui/detail-field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableSkeleton } from '@/components/ui/table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import {
  createDataTableColumnDsl,
  dataTableHeader
} from '@/components/ui/table/columns/data-table-column-factory';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslPageRequestBase } from '@/hooks/use-dsl-data-table.dsl';
import {
  iamLoginLogDetailQueryOptions,
  iamLoginLogPageQueryKey,
  iamLoginLogPageQueryOptions,
  iamOperationLogDetailQueryOptions,
  iamOperationLogPageQueryKey,
  iamOperationLogPageQueryOptions,
  type IamLoginLogPageRequest,
  type IamLoginLogPageResponse,
  type IamOperationLogPageResponse,
  type LoginLogRspDTO,
  type OperationLogRspDTO
} from '@/lib/api/clients/service';
import { nullableText } from '@/lib/display-formatters';
import { BOOLEAN_RESULT_OPTIONS, LOGIN_RESULT_OPTIONS } from '../lib/constants';
import {
  BooleanResultBadge,
  formatOptionalDateTime,
  LoginResultBadge
} from '../lib/format';
import { dslConditionNumber, dslConditionValue, dslDateTimeRange, pageRequestFromDsl } from '../lib/table';

const LOGIN_LOG_TABLE_ID = 'iam-login-log-list';
const OPERATION_LOG_TABLE_ID = 'iam-operation-log-list';

const loginLogDsl = createDataTableColumnDsl<LoginLogRspDTO>();
const operationLogDsl = createDataTableColumnDsl<OperationLogRspDTO>();

function loginLogQueryOptions(request: DataTableDslPageRequestBase) {
  const condition = request.condition;
  return iamLoginLogPageQueryOptions({
    ...pageRequestFromDsl(request),
    username: dslConditionValue(condition, 'username'),
    staffName: dslConditionValue(condition, 'staffName'),
    result: dslConditionValue(condition, 'result') as IamLoginLogPageRequest['result'],
    ip: dslConditionValue(condition, 'ip'),
    operationTimeRange: dslDateTimeRange(condition, 'operationTime')
  });
}

function operationLogQueryOptions(request: DataTableDslPageRequestBase) {
  const condition = request.condition;
  const success = dslConditionValue(condition, 'success');
  return iamOperationLogPageQueryOptions({
    ...pageRequestFromDsl(request),
    operatorId: dslConditionNumber(condition, 'operatorId'),
    operatorUsername: dslConditionValue(condition, 'operatorUsername'),
    operatorStaffName: dslConditionValue(condition, 'operatorStaffName'),
    module: dslConditionValue(condition, 'module'),
    action: dslConditionValue(condition, 'action'),
    success: success == null ? undefined : success === 'true',
    requestPath: dslConditionValue(condition, 'requestPath'),
    operationTimeRange: dslDateTimeRange(condition, 'operationTime')
  });
}

function getLoginLogColumns(onOpenDetail: (log: LoginLogRspDTO) => void): Array<ColumnDef<LoginLogRspDTO>> {
  return [
    {
      accessorKey: 'username',
      header: ({ column }) => dataTableHeader(column, '用户名'),
      size: 150,
      enableColumnFilter: true,
      meta: { variant: 'text', label: '用户名', placeholder: '搜索用户名' },
      cell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[150px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.username)}
        </Button>
      )
    },
    loginLogDsl.field('staffName', '员工姓名', {
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索员工姓名'
    }),
    {
      accessorKey: 'result',
      header: ({ column }) => dataTableHeader(column, '结果'),
      size: 110,
      enableColumnFilter: true,
      meta: { variant: 'select', label: '结果', options: [...LOGIN_RESULT_OPTIONS] },
      cell: ({ row }) => <LoginResultBadge result={row.original.result} />
    },
    loginLogDsl.field('ip', 'IP', {
      size: 150,
      filter: 'text',
      filterPlaceholder: '搜索IP'
    }),
    loginLogDsl.field('eventType', '事件', { size: 120 }),
    loginLogDsl.field('failureReason', '失败原因', {
      size: 220,
      cellClassName: 'max-w-[220px]'
    }),
    loginLogDsl.field('operationTime', '时间', {
      type: 'dateTime',
      size: 180,
      filter: 'dateRange'
    })
  ];
}

function getOperationLogColumns(onOpenDetail: (log: OperationLogRspDTO) => void): Array<ColumnDef<OperationLogRspDTO>> {
  return [
    {
      accessorKey: 'operatorUsername',
      header: ({ column }) => dataTableHeader(column, '操作人'),
      size: 150,
      enableColumnFilter: true,
      meta: { variant: 'text', label: '操作人', placeholder: '搜索用户名' },
      cell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[150px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.operatorUsername)}
        </Button>
      )
    },
    operationLogDsl.field('operatorStaffName', '员工姓名', {
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索员工姓名'
    }),
    operationLogDsl.field('module', '模块', {
      size: 130,
      filter: 'text',
      filterPlaceholder: '搜索模块'
    }),
    operationLogDsl.field('action', '动作', {
      size: 130,
      filter: 'text',
      filterPlaceholder: '搜索动作'
    }),
    {
      accessorKey: 'success',
      header: ({ column }) => dataTableHeader(column, '结果'),
      size: 110,
      enableColumnFilter: true,
      meta: { variant: 'select', label: '结果', options: [...BOOLEAN_RESULT_OPTIONS] },
      cell: ({ row }) => <BooleanResultBadge value={row.original.success} />
    },
    operationLogDsl.field('requestPath', '路径', {
      size: 240,
      filter: 'text',
      filterPlaceholder: '搜索路径',
      cellClassName: 'max-w-[240px]'
    }),
    operationLogDsl.field('costMillis', '耗时(ms)', { type: 'int', size: 110 }),
    operationLogDsl.field('operationTime', '时间', {
      type: 'dateTime',
      size: 180,
      filter: 'dateRange'
    })
  ];
}

function LoginLogDetailSheet({
  log,
  open,
  onOpenChange
}: {
  log?: LoginLogRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logId = log?.logId;
  const detailQuery = useQuery({
    ...iamLoginLogDetailQueryOptions({ logId: logId ?? 0 }),
    enabled: open && logId != null
  });
  const detail = detailQuery.data ?? log;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>登录日志详情</SheetTitle>
          <SheetDescription>{detail?.username ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='日志ID' value={detail?.logId} />
          <FieldItem label='员工ID' value={detail?.staffId} />
          <FieldItem label='用户名' value={detail?.username} />
          <FieldItem label='员工姓名' value={detail?.staffName} />
          <FieldItem label='事件' value={detail?.eventType} />
          <FieldItem label='结果' value={detail?.result} />
          <FieldItem label='IP' value={detail?.ip} />
          <FieldItem label='Token ID' value={detail?.tokenId} valueMaxLines={1} />
          <FieldItem label='时间' value={formatOptionalDateTime(detail?.operationTime)} />
          <FieldItem label='失败原因' value={detail?.failureReason} valueMaxLines={2} />
          <FieldItem label='User Agent' value={detail?.userAgent} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OperationLogDetailSheet({
  log,
  open,
  onOpenChange
}: {
  log?: OperationLogRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logId = log?.logId;
  const detailQuery = useQuery({
    ...iamOperationLogDetailQueryOptions({ logId: logId ?? 0 }),
    enabled: open && logId != null
  });
  const detail = detailQuery.data ?? log;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-2xl flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>操作日志详情</SheetTitle>
          <SheetDescription>{detail?.module ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='日志ID' value={detail?.logId} />
          <FieldItem label='操作人ID' value={detail?.operatorId} />
          <FieldItem label='用户名' value={detail?.operatorUsername} />
          <FieldItem label='员工姓名' value={detail?.operatorStaffName} />
          <FieldItem label='模块' value={detail?.module} />
          <FieldItem label='动作' value={detail?.action} />
          <FieldItem label='结果' value={detail?.success ? '成功' : '失败'} />
          <FieldItem label='耗时' value={detail?.costMillis == null ? '-' : `${detail.costMillis} ms`} />
          <FieldItem label='方法' value={detail?.httpMethod} />
          <FieldItem label='IP' value={detail?.ip} />
          <FieldItem label='路径' value={detail?.requestPath} valueMaxLines={2} />
          <FieldItem label='时间' value={formatOptionalDateTime(detail?.operationTime)} />
          <FieldItem label='请求摘要' value={detail?.requestSummary} valueMaxLines={2} />
          <FieldItem label='响应摘要' value={detail?.responseSummary} valueMaxLines={2} />
          <FieldItem label='错误信息' value={detail?.errorMessage} valueMaxLines={2} />
          <FieldItem label='User Agent' value={detail?.userAgent} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function LoginLogPage() {
  const [detailLog, setDetailLog] = React.useState<LoginLogRspDTO | null>(null);
  const columns = React.useMemo(() => getLoginLogColumns(setDetailLog), []);
  const { table, total, queryState, refreshProps } = useDslDataTable<
    LoginLogRspDTO,
    DataTableDslPageRequestBase,
    IamLoginLogPageResponse,
    ApiClientError,
    ReturnType<typeof iamLoginLogPageQueryKey>
  >({
    tableId: LOGIN_LOG_TABLE_ID,
    columns,
    queryOptions: loginLogQueryOptions,
    rowId: 'logId',
    showSelectColumn: false,
    refreshBehavior: {
      onSuccess: () => {
        toast.success('登录日志已刷新');
      }
    }
  });

  return (
    <>
      <Card>
        <CardContent className='px-0'>
          <div className='px-6 pb-3'>
            <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
          </div>
          {queryState.isFetching && !queryState.data ? (
            <DataTableSkeleton columnCount={7} filterCount={5} />
          ) : (
            <DataTable
              table={table}
              statusTotalCount={total}
              isLoading={queryState.isFetching}
              onRefresh={refreshProps?.onRefresh}
              isRefreshing={refreshProps?.isRefreshing}
            />
          )}
        </CardContent>
      </Card>
      <LoginLogDetailSheet
        open={!!detailLog}
        onOpenChange={(open) => !open && setDetailLog(null)}
        log={detailLog}
      />
    </>
  );
}

export function OperationLogPage() {
  const [detailLog, setDetailLog] = React.useState<OperationLogRspDTO | null>(null);
  const columns = React.useMemo(() => getOperationLogColumns(setDetailLog), []);
  const { table, total, queryState, refreshProps } = useDslDataTable<
    OperationLogRspDTO,
    DataTableDslPageRequestBase,
    IamOperationLogPageResponse,
    ApiClientError,
    ReturnType<typeof iamOperationLogPageQueryKey>
  >({
    tableId: OPERATION_LOG_TABLE_ID,
    columns,
    queryOptions: operationLogQueryOptions,
    rowId: 'logId',
    showSelectColumn: false,
    refreshBehavior: {
      onSuccess: () => {
        toast.success('操作日志已刷新');
      }
    }
  });

  return (
    <>
      <Card>
        <CardContent className='px-0'>
          <div className='px-6 pb-3'>
            <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
          </div>
          {queryState.isFetching && !queryState.data ? (
            <DataTableSkeleton columnCount={8} filterCount={6} />
          ) : (
            <DataTable
              table={table}
              statusTotalCount={total}
              isLoading={queryState.isFetching}
              onRefresh={refreshProps?.onRefresh}
              isRefreshing={refreshProps?.isRefreshing}
            />
          )}
        </CardContent>
      </Card>
      <OperationLogDetailSheet
        open={!!detailLog}
        onOpenChange={(open) => !open && setDetailLog(null)}
        log={detailLog}
      />
    </>
  );
}
