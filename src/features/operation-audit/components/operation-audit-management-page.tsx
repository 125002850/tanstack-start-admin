import { DictionaryScope } from '@/components/dictionary/dictionary-scope';
import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { DataTableToolbar } from '@/components/data-table/toolbar/data-table-toolbar';
import { Icons } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { useDict } from '@/hooks/use-dict';
import { useDslDataTable } from '@/hooks/use-data-table';
import {
  pageOperationAuditLogsQueryKey,
  pageOperationAuditLogsQueryOptions,
  type OperationAuditLogRspDTO,
  type PageOperationAuditLogsQueryRequest,
  type PageOperationAuditLogsResponse
} from '@/lib/api/clients/service';
import { nullableDateTime, nullableOperatorLabel } from '@/lib/formatters/display';
import type { DataTableRowAction } from '@/types/data-table';

import { OperationAuditDetailSheet } from './operation-audit-detail-sheet';
import { operationAuditEnumCode, operationAuditEnumLabel } from '../operation-audit-enum';

const TABLE_ID = 'operation-audit-log-list';
const DEFAULT_REQUEST_SORT = [
  { field: 'operationTime', direction: 'DESC' as const },
  { field: 'logId', direction: 'DESC' as const }
];
const columnDsl = createDataTableColumnDsl<OperationAuditLogRspDTO>();

function formatDuration(durationMs: number | undefined) {
  if (durationMs == null) return '-';
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(2)} s`;
}

export default function OperationAuditManagementPage() {
  return (
    <DictionaryScope typeCodes={['OPERATION_AUDIT_ACTION', 'OPERATION_AUDIT_STATUS']}>
      <OperationAuditContent />
    </DictionaryScope>
  );
}
function OperationAuditContent() {
  const action = useDict('OPERATION_AUDIT_ACTION');
  const status = useDict('OPERATION_AUDIT_STATUS');

  const columns = React.useMemo<Array<ColumnDef<OperationAuditLogRspDTO>>>(
    () => [
      columnDsl.field('moduleName', '模块', {
        size: 170,
        filter: 'text',
        filterPlaceholder: '搜索模块',
        enableSorting: true
      }),
      columnDsl.field('description', '描述', {
        size: 220,
        filter: 'text',
        filterPlaceholder: '搜索描述',
        enableSorting: false
      }),
      columnDsl.field('operatorName', '操作人', {
        size: 150,
        filter: 'text',
        filterPlaceholder: '搜索操作人',
        enableSorting: true,
        format: (value, row) => nullableOperatorLabel({ id: row.operatorId, name: value })
      }),
      columnDsl.field('clientIp', '操作 IP', {
        size: 150,
        filter: 'text',
        filterPlaceholder: '搜索操作 IP',
        enableSorting: false
      }),
      columnDsl.field('action', '动作', {
        size: 120,
        filter: 'select',
        filterOptions: action.options,
        dsl: { filterNodeType: 'enum' },
        format: (value) => {
          const code = operationAuditEnumCode(value);
          const label = action.getLabel(code);
          return label || operationAuditEnumLabel(value);
        }
      }),
      columnDsl.badge('resultStatus', '状态', {
        size: 100,
        filter: 'select',
        filterOptions: status.options,
        dsl: { filterNodeType: 'enum' },
        format: (value) => {
          const code = operationAuditEnumCode(value);
          const label = status.getLabel(code);
          return label ?? operationAuditEnumLabel(value);
        },
        variant: (value) =>
          operationAuditEnumCode(value) === 'failed'
            ? 'destructive'
            : operationAuditEnumCode(value) === 'success'
              ? 'success'
              : 'outline'
      }),
      columnDsl.field('durationMs', '耗时', {
        size: 100,
        type: 'number',
        filter: false,
        format: (value) => formatDuration(value)
      }),
      columnDsl.field('operationTime', '操作时间', {
        size: 180,
        type: 'dateTime',
        filter: 'dateRange',
        enableSorting: true,
        format: (value) => nullableDateTime(value)
      }),
      columnDsl.custom({
        id: 'traceId',
        title: 'Trace ID',
        size: 240,
        filter: false,
        enableSorting: false,
        columnPanelVisible: false,
        cell: () => null
      }),
      columnDsl.custom({
        id: 'requestPath',
        title: '请求路径',
        size: 280,
        filter: false,
        enableSorting: false,
        columnPanelVisible: false,
        cell: () => null
      })
    ],
    [action, status]
  );

  const rowActions = React.useMemo<DataTableRowAction<OperationAuditLogRspDTO>[]>(
    () => [
      {
        label: '详情',
        icon: <Icons.eye className='size-4' />,
        disabled: (row) => row.logId == null,
        Sheet: OperationAuditDetailSheet
      }
    ],
    []
  );

  const { table, queryState, refreshProps } = useDslDataTable<
    OperationAuditLogRspDTO,
    PageOperationAuditLogsQueryRequest,
    PageOperationAuditLogsResponse,
    ApiClientError,
    ReturnType<typeof pageOperationAuditLogsQueryKey>
  >({
    tableId: TABLE_ID,
    columns,
    queryOptions: pageOperationAuditLogsQueryOptions,
    defaultRequestSort: DEFAULT_REQUEST_SORT,
    showSelectColumn: false,
    rowActions,
    rowId: 'logId',
    initialState: {
      columnVisibility: { traceId: false, requestPath: false }
    },
    refreshBehavior: {
      onSuccess: () => {
        toast.success('操作日志已刷新');
      }
    }
  });

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <Card className='min-h-0 flex-1'>
        <CardContent className='min-h-0 flex-1 px-0'>
          <DataTable
            table={table}
            isLoading={queryState.isFetching && !queryState.data}
            loadingSkeleton={{ columnCount: 8, filterCount: 4 }}
            {...refreshProps}
            getStatusConfig={({ rows, hasFilters, isLoading }) =>
              !rows.length && !isLoading
                ? hasFilters
                  ? {
                      type: 'empty',
                      title: '未找到匹配的操作日志',
                      description: '请调整模块、动作、操作人或操作时间等筛选条件。'
                    }
                  : {
                      type: 'empty',
                      title: '暂无操作日志',
                      description: '完成新增、修改、发布、导出等操作后会在这里显示。'
                    }
                : undefined
            }
          >
            <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
