import { DictionaryScope } from '@/components/dictionary/dictionary-scope';
import { useDict } from '@/hooks/use-dict';
import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/data-table/core/data-table';
import type { DataTableAction } from '@/types/data-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import type { DataTableRowAction } from '@/types/data-table';
import { DataTableToolbar } from '@/components/data-table/toolbar/data-table-toolbar';
import { useDslDataTable } from '@/hooks/use-data-table';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import {
  type ScheduleJobRspDTO,
  systemScheduleJobPageQueryKey,
  systemScheduleJobPageQueryOptions,
  type SystemScheduleJobPageQueryRequest,
  type SystemScheduleJobPageResponse,
  systemScheduleJobDeleteMutationOptions,
  type SystemScheduleJobDeleteRequest,
  type SystemScheduleJobDeleteResponse,
  systemScheduleJobEnableMutationOptions,
  type SystemScheduleJobEnableRequest,
  type SystemScheduleJobEnableResponse,
  systemScheduleJobDisableMutationOptions,
  type SystemScheduleJobDisableRequest,
  type SystemScheduleJobDisableResponse,
  systemScheduleJobTriggerMutationOptions,
  type SystemScheduleJobTriggerRequest,
  type SystemScheduleJobTriggerResponse,
  ScheduleJobRspDTOStatus
} from '@/lib/api/clients/service';

import { ScheduleJobFormSheet } from './schedule-job-form-sheet';
import { ScheduleJobOperationLogSheet } from './schedule-job-operation-log-sheet';
import { ScheduleJobExecutionLogSheet } from './schedule-job-execution-log-sheet';

const TABLE_ID = 'schedule-center-list';

type ScheduleJobRecord = ScheduleJobRspDTO;

function getStatusBadgeVariant(status?: string): React.ComponentProps<typeof Badge>['variant'] {
  if (!status) return 'outline';
  const key = status.toLowerCase();
  if (key === ScheduleJobRspDTOStatus.enable) return 'default';
  if (key === ScheduleJobRspDTOStatus.disable) return 'secondary';
  return 'outline';
}

const columnDsl = createDataTableColumnDsl<ScheduleJobRecord>();

function getColumns(
  onToggleStatus: (row: ScheduleJobRecord) => void,
  status: ReturnType<typeof useDict>
): Array<ColumnDef<ScheduleJobRecord>> {
  return [
    columnDsl.field('jobName', '任务名称', {
      size: 200,
      filter: 'text',
      filterPlaceholder: '搜索任务名称'
    }),
    columnDsl.field('jobCode', '任务编码', {
      size: 180,
      filter: 'text',
      filterPlaceholder: '搜索任务编码'
    }),
    columnDsl.field('groupName', '任务分组', {
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索分组'
    }),
    columnDsl.field('cronExpression', 'Cron 表达式', {
      size: 180,
      cellClassName: 'font-mono text-xs'
    }),
    columnDsl.field('invokeRoute', '调用路由', {
      size: 220,
      cellClassName: 'font-mono text-xs'
    }),
    columnDsl.field('status', '状态', {
      size: 100,
      filter: 'select',
      filterOptions: status.options,
      dsl: { filterNodeType: 'enum' },
      enableSorting: false,
      renderCell: ({ row }) => (
        <Badge asChild variant={getStatusBadgeVariant(row.original.status as string)}>
          <button
            type='button'
            className='cursor-pointer'
            onClick={() => onToggleStatus(row.original)}
          >
            {status.getLabel(row.original.status ?? '')}
          </button>
        </Badge>
      )
    }),
    columnDsl.field('remark', '备注', {
      size: 'lg',
      cellClassName: 'max-w-[200px]'
    }),
    ...columnDsl.audit()
  ];
}

export default function ScheduleCenterManagementPage() {
  return (
    <DictionaryScope typeCodes={['ENABLE_STATUS']}>
      <ScheduleCenterContent />
    </DictionaryScope>
  );
}
function ScheduleCenterContent() {
  const status = useDict('ENABLE_STATUS');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<ScheduleJobRecord | null>(null);
  const [opLogJob, setOpLogJob] = React.useState<ScheduleJobRecord | null>(null);
  const [opLogOpen, setOpLogOpen] = React.useState(false);
  const [execLogJob, setExecLogJob] = React.useState<ScheduleJobRecord | null>(null);
  const [execLogOpen, setExecLogOpen] = React.useState(false);

  const handleOpenCreate = React.useCallback(() => {
    setEditingRecord(null);
    setFormOpen(true);
  }, []);

  const handleOpenEdit = React.useCallback((record: ScheduleJobRecord) => {
    setEditingRecord(record);
    setFormOpen(true);
  }, []);

  const handleFormOpenChange = React.useCallback((open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingRecord(null);
    }
  }, []);

  const enableMutationOpts = systemScheduleJobEnableMutationOptions();
  const enableMutation = useMutation<
    SystemScheduleJobEnableResponse,
    ApiClientError,
    SystemScheduleJobEnableRequest
  >({
    ...enableMutationOpts,
    onSuccess: (...args) => {
      toast.success('任务已启用');
      return enableMutationOpts.onSuccess?.(...args);
    },
    onError: (error) =>
      toast.error(
        normalizeApiError(error, { fallbackMessage: '任务启用失败，请稍后重试。' }).message
      )
  });

  const disableMutationOpts = systemScheduleJobDisableMutationOptions();
  const disableMutation = useMutation<
    SystemScheduleJobDisableResponse,
    ApiClientError,
    SystemScheduleJobDisableRequest
  >({
    ...disableMutationOpts,
    onSuccess: (...args) => {
      toast.success('任务已禁用');
      return disableMutationOpts.onSuccess?.(...args);
    },
    onError: (error) =>
      toast.error(
        normalizeApiError(error, { fallbackMessage: '任务禁用失败，请稍后重试。' }).message
      )
  });

  const handleToggleStatus = React.useCallback(
    async (row: ScheduleJobRecord) => {
      if (row.id == null) return;
      try {
        if (row.status === ScheduleJobRspDTOStatus.enable) {
          await disableMutation.mutateAsync({ id: row.id });
        } else {
          await enableMutation.mutateAsync({ id: row.id });
        }
      } catch {
        // mutation handles toast
      }
    },
    [disableMutation, enableMutation]
  );

  const columns = React.useMemo(
    () => getColumns(handleToggleStatus, status),
    [handleToggleStatus, status]
  );

  const deleteMutationOpts = systemScheduleJobDeleteMutationOptions();
  const deleteMutation = useMutation<
    SystemScheduleJobDeleteResponse,
    ApiClientError,
    SystemScheduleJobDeleteRequest
  >({
    ...deleteMutationOpts,
    onSuccess: (...args) => {
      toast.success('任务已删除');
      return deleteMutationOpts.onSuccess?.(...args);
    },
    onError: (error) => {
      toast.error(
        normalizeApiError(error, { fallbackMessage: '任务删除失败，请稍后重试。' }).message
      );
    }
  });

  const triggerMutationOpts = systemScheduleJobTriggerMutationOptions();
  const triggerMutation = useMutation<
    SystemScheduleJobTriggerResponse,
    ApiClientError,
    SystemScheduleJobTriggerRequest
  >({
    ...triggerMutationOpts,
    onSuccess: (...args) => {
      toast.success('已触发执行');
      return triggerMutationOpts.onSuccess?.(...args);
    },
    onError: (error) =>
      toast.error(
        normalizeApiError(error, { fallbackMessage: '任务触发失败，请稍后重试。' }).message
      )
  });

  const rowActions = React.useMemo<DataTableRowAction<ScheduleJobRecord>[]>(
    () => [
      {
        label: '编辑',
        icon: <Icons.edit className='size-4' />,
        onClick: handleOpenEdit
      },
      {
        label: '立即触发',
        icon: <Icons.rotateClockwise className='size-4' />,
        disabled: (row) => row.id == null || row.status !== ScheduleJobRspDTOStatus.enable,
        confirmDelete: {
          title: '确认立即触发任务？',
          description: (row) => `确定要立即触发一次定时任务【${row.jobName ?? row.jobCode}】吗？`,
          confirmText: '立即执行',
          cancelText: '取消'
        },
        onClick: async (row: ScheduleJobRecord) => {
          if (row.id == null) return;
          await triggerMutation.mutateAsync({ id: row.id });
        }
      },
      {
        label: '执行记录',
        icon: <Icons.chartInfographic className='size-4' />,
        onClick: (row: ScheduleJobRecord) => {
          setExecLogJob(row);
          setExecLogOpen(true);
        }
      },
      {
        label: '操作记录',
        icon: <Icons.clipboardList className='size-4' />,
        onClick: (row: ScheduleJobRecord) => {
          setOpLogJob(row);
          setOpLogOpen(true);
        }
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        disabled: (row) => row.id == null || row.status === ScheduleJobRspDTOStatus.enable,
        confirmDelete: {
          title: '确认删除任务',
          description: () => '删除后不可恢复，请确认操作。',
          confirmText: '确认删除',
          cancelText: '取消'
        },
        onClick: async (row: ScheduleJobRecord) => {
          if (row.id == null) return;
          if (row.status === ScheduleJobRspDTOStatus.enable) {
            toast.error('启用状态的任务无法删除，请先禁用');
            return;
          }
          await deleteMutation.mutateAsync({ id: row.id });
        }
      }
    ],
    [deleteMutation, handleOpenEdit, triggerMutation]
  );

  const { table, queryState, refreshProps } = useDslDataTable<
    ScheduleJobRecord,
    SystemScheduleJobPageQueryRequest,
    SystemScheduleJobPageResponse,
    ApiClientError,
    ReturnType<typeof systemScheduleJobPageQueryKey>
  >({
    tableId: TABLE_ID,
    columns,
    queryOptions: systemScheduleJobPageQueryOptions,
    showSelectColumn: false,
    rowActions,
    refreshBehavior: {
      onSuccess: () => {
        toast.success('调度中心已刷新');
      }
    }
  });

  const tableActions = React.useMemo<DataTableAction<ScheduleJobRecord>[]>(
    () => [
      {
        label: '新增任务',
        icon: <Icons.add className='size-4' />,
        callback: handleOpenCreate
      }
    ],
    [handleOpenCreate]
  );

  const isInitialLoading = queryState.isFetching && !queryState.data;

  return (
    <>
      <Card>
        <CardContent className='min-h-0 flex-1 px-0'>
          <DataTable
            table={table}
            isLoading={isInitialLoading}
            tableActions={tableActions}
            {...refreshProps}
            getStatusConfig={({ rows, hasFilters, isLoading: isTableLoading }) => {
              if (!rows.length && !isTableLoading) {
                if (!hasFilters) {
                  return {
                    type: 'empty',
                    title: '暂无定时任务',
                    description: '新增任务后可在这里管理。'
                  };
                }
                return {
                  type: 'empty',
                  title: '未找到匹配的任务',
                  description: '尝试调整任务名称或编码筛选条件。'
                };
              }
            }}
          >
            <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
          </DataTable>
        </CardContent>
      </Card>
      <ScheduleJobFormSheet
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        editingRecord={editingRecord}
      />
      {opLogJob ? (
        <ScheduleJobOperationLogSheet
          job={opLogJob}
          open={opLogOpen}
          onOpenChange={(open) => {
            setOpLogOpen(open);
            if (!open) setOpLogJob(null);
          }}
        />
      ) : null}
      {execLogJob ? (
        <ScheduleJobExecutionLogSheet
          job={execLogJob}
          open={execLogOpen}
          onOpenChange={(open) => {
            setExecLogOpen(open);
            if (!open) setExecLogJob(null);
          }}
        />
      ) : null}
    </>
  );
}
