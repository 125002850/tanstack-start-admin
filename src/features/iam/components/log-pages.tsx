import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableSkeleton } from '@/components/ui/table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { useDict } from '@/hooks/use-dict';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslPageRequestBase } from '@/hooks/use-dsl-data-table.dsl';
import {
  iamLoginLogPageQueryKey,
  iamLoginLogPageQueryOptions,
  iamOperationLogPageQueryKey,
  iamOperationLogPageQueryOptions,
  type IamLoginLogPageRequest,
  type IamLoginLogPageResponse,
  type IamOperationLogPageResponse,
  type LoginLogRspDTO,
  type OperationLogRspDTO
} from '@/lib/api/clients/service';
import { nullableText } from '@/lib/display-formatters';
import { BOOLEAN_RESULT_OPTIONS } from '../lib/constants';
import { BooleanResultBadge, LoginResultBadge } from '../lib/format';
import { dslConditionNumber, dslConditionValue, dslDateTimeRange, pageRequestFromDsl } from '../lib/table';

import LoginLogDetailSheet from './login-log-detail-sheet';
import OperationLogDetailSheet from './operation-log-detail-sheet';

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

function getLoginLogColumns(
  onOpenDetail: (log: LoginLogRspDTO) => void,
  loginDicts: {
    eventTypeDict: { getLabel: (code: string) => string; options: Array<{ value: string; label: string }> };
    resultDict: { getLabel: (code: string) => string; options: Array<{ value: string; label: string }> };
    failureReasonDict: { getLabel: (code: string) => string; options: Array<{ value: string; label: string }> };
  }
): Array<ColumnDef<LoginLogRspDTO>> {
  return [
    loginLogDsl.field('username', '用户名', {
      size: 'md',
      filter: 'text',
      filterPlaceholder: '搜索用户名',
      enableSorting: true,
      renderCell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[150px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.username)}
        </Button>
      )
    }),
    loginLogDsl.field('staffName', '员工姓名', {
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索员工姓名'
    }),
    loginLogDsl.field('result', '结果', {
      size: 'sm',
      filter: 'select',
      filterOptions: loginDicts.resultDict.options,
      filterPlaceholder: '选择结果',
      enableSorting: true,
      renderCell: ({ row }) => (
        <LoginResultBadge result={row.original.result} getLabel={loginDicts.resultDict.getLabel} />
      )
    }),
    loginLogDsl.field('ip', 'IP', {
      size: 'md',
      filter: 'text',
      filterPlaceholder: '搜索IP'
    }),
    loginLogDsl.field('eventType', '事件', {
      size: 120,
      enableSorting: true,
      renderCell: ({ row }) => {
        const val = row.original.eventType;
        return val ? loginDicts.eventTypeDict.getLabel(val) : '-';
      }
    }),
    loginLogDsl.field('failureReason', '失败原因', {
      size: 'xl',
      enableSorting: true,
      renderCell: ({ row }) => {
        const val = row.original.failureReason;
        return val ? loginDicts.failureReasonDict.getLabel(val) : '-';
      }
    }),
    loginLogDsl.field('operationTime', '时间', {
      type: 'dateTime',
      size: 'lg',
      filter: 'dateRange'
    })
  ];
}

function getOperationLogColumns(
  onOpenDetail: (log: OperationLogRspDTO) => void,
  actionDict: { getLabel: (code: string) => string; options: Array<{ value: string; label: string }> }
): Array<ColumnDef<OperationLogRspDTO>> {
  return [
    operationLogDsl.field('operatorUsername', '操作人', {
      size: 'md',
      filter: 'text',
      filterPlaceholder: '搜索用户名',
      enableSorting: true,
      renderCell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[150px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.operatorUsername)}
        </Button>
      )
    }),
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
      filter: 'select',
      filterOptions: actionDict.options,
      filterPlaceholder: '选择动作',
      enableSorting: true,
      renderCell: ({ row }) => actionDict.getLabel(row.original.action ?? '')
    }),
    operationLogDsl.field('success', '结果', {
      size: 'sm',
      filter: 'select',
      filterOptions: [...BOOLEAN_RESULT_OPTIONS],
      enableSorting: true,
      renderCell: ({ row }) => <BooleanResultBadge value={row.original.success} />
    }),
    operationLogDsl.field('requestPath', '路径', {
      size: 'xxl',
      filter: 'text',
      filterPlaceholder: '搜索路径',
      cellClassName: 'max-w-[240px]'
    }),
    operationLogDsl.field('costMillis', '耗时(ms)', {
      type: 'int',
      size: 'sm'
    }),
    operationLogDsl.field('operationTime', '时间', {
      type: 'dateTime',
      size: 'lg',
      filter: 'dateRange'
    })
  ];
}

export function LoginLogPage() {
  const [detailLog, setDetailLog] = React.useState<LoginLogRspDTO | null>(null);
  const eventTypeDict = useDict('IAM_LOGIN_EVENT_TYPE');
  const resultDict = useDict('IAM_LOGIN_RESULT');
  const failureReasonDict = useDict('IAM_LOGIN_FAILURE_REASON');
  const loginDicts = React.useMemo(
    () => ({ eventTypeDict, resultDict, failureReasonDict }),
    [eventTypeDict, resultDict, failureReasonDict]
  );
  const columns = React.useMemo(() => getLoginLogColumns(setDetailLog, loginDicts), [loginDicts]);
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
  const actionDict = useDict('IAM_OPERATION_LOG_ACTION');
  const columns = React.useMemo(() => getOperationLogColumns(setDetailLog, actionDict), [actionDict]);
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
