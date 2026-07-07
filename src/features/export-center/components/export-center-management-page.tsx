import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/table/core/data-table';
import type {
  DataTableAction,
  DataTableActionContext
} from '@/components/ui/table/actions/data-table-actions-bar';
import { auditColumns } from '@/components/ui/table/columns/data-table-audit-columns';
import {
  createDataTableColumnDsl,
  dataTableHeader,
  dataTableTextCell
} from '@/components/ui/table/columns/data-table-column-factory';
import { DataTableLinkButtonCell } from '@/components/ui/table/cells/data-table-link-button-cell';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import { DataTableSkeleton } from '@/components/ui/table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import { useDict } from '@/hooks/use-dict';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import { EXPORT_RECORD_STATUS } from '@/constants/enums';
import { downloadFileFromUrl } from '@/lib/download-file';
import { getDictLabel, nullableText } from '@/lib/display-formatters';
import { getQueryClient } from '@/lib/query-client';
import {
  batchDownloadExportRecordsMutationOptions,
  deleteExportRecordMutationOptions,
  downloadExportRecordMutationOptions,
  type ExportRecordRspDTO,
  pageMyExportRecordsQueryKey,
  pageMyExportRecordsQueryOptions,
  type PageMyExportRecordsQueryRequest,
  type PageMyExportRecordsResponse
} from '@/lib/api/clients/service';

import { ExportRecordDetailSheet } from './export-record-detail-sheet';

const TABLE_ID = 'export-center-list';
const DEFAULT_REQUEST_SORT = [{ field: 'createTime', direction: 'DESC' as const }];
const DOWNLOAD_URL_CACHE_SKEW_MS = 30_000;
const AMZ_DATE_REGEX = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
const EXPORT_RECORD_LIST_QUERY_KEY = ['service', 'export-my'] as const;

const EXPORT_RECORD_STATUS_NAME_VARIANTS = {
  FAILED: 'destructive',
  FAILURE: 'destructive',
  ERROR: 'destructive',
  SUCCESS: 'default',
  COMPLETED: 'default',
  COMPLETE: 'default',
  DONE: 'default',
  PROCESSING: 'secondary',
  RUNNING: 'secondary',
  PENDING: 'secondary'
} satisfies Record<string, React.ComponentProps<typeof Badge>['variant']>;

type ExportRecordRecord = ExportRecordRspDTO;

const columnDsl = createDataTableColumnDsl<ExportRecordRecord>();

interface CachedDownloadUrl {
  url: string;
  expiresAt: number;
}

function getStatusBadgeVariant(
  record: ExportRecordRecord
): React.ComponentProps<typeof Badge>['variant'] {
  switch (record.status) {
    case EXPORT_RECORD_STATUS.FAILED:
      return 'destructive';
    case EXPORT_RECORD_STATUS.SUCCESS:
      return 'default';
    case EXPORT_RECORD_STATUS.PROCESSING:
      return 'secondary';
  }

  const statusName = record.statusName?.trim().toUpperCase();
  const statusNameVariant =
    statusName == null
      ? undefined
      : EXPORT_RECORD_STATUS_NAME_VARIANTS[
          statusName as keyof typeof EXPORT_RECORD_STATUS_NAME_VARIANTS
        ];
  if (statusNameVariant) return statusNameVariant;

  return 'outline';
}

function resolveExportStatusLabel(
  record: ExportRecordRecord,
  getStatusLabel: (code: string) => string
) {
  return (
    getDictLabel(getStatusLabel, record.status) ??
    getDictLabel(getStatusLabel, record.statusName) ??
    record.statusName ??
    nullableText(record.status)
  );
}

function parseAmzDate(value: string) {
  const match = AMZ_DATE_REGEX.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function getTemporaryDownloadUrlExpiresAt(downloadUrl: string) {
  try {
    const url = new URL(downloadUrl, 'http://localhost');
    const amzDate = url.searchParams.get('X-Amz-Date');
    const amzExpires = url.searchParams.get('X-Amz-Expires');
    if (!amzDate || !amzExpires) return null;

    const issuedAt = parseAmzDate(amzDate);
    const expiresInSeconds = Number(amzExpires);
    if (issuedAt == null || !Number.isFinite(expiresInSeconds)) return null;

    return issuedAt + expiresInSeconds * 1000;
  } catch {
    return null;
  }
}

function isZipExportRecord(record: ExportRecordRecord) {
  return (
    record.fileType?.toLowerCase() === 'zip' ||
    record.contentType?.toLowerCase() === 'application/zip'
  );
}

function isExportRecordReadyForDownload(record: ExportRecordRecord) {
  return record.recordId != null && record.status === EXPORT_RECORD_STATUS.SUCCESS;
}

function invalidateExportRecordListQueries() {
  return getQueryClient().invalidateQueries({
    queryKey: EXPORT_RECORD_LIST_QUERY_KEY,
    exact: false
  });
}

function getColumns(
  onOpenDetail: (record: ExportRecordRecord) => void,
  getStatusLabel: (record: ExportRecordRecord) => string
): Array<ColumnDef<ExportRecordRecord>> {
  return [
    {
      accessorKey: 'fileName',
      header: ({ column }) => dataTableHeader(column, '文件名'),
      size: 260,
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        variant: 'text',
        label: '文件名',
        placeholder: '搜索文件名'
      },
      cell: ({ row }) => {
        if (!row.original.fileName) {
          return dataTableTextCell(row.original.fileName, 'max-w-[260px]');
        }
        const fileName = nullableText(row.original.fileName);
        return (
          <DataTableLinkButtonCell
            value={dataTableTextCell(fileName, 'max-w-[260px]')}
            className='max-w-[260px]'
            onClick={() => onOpenDetail(row.original)}
          />
        );
      }
    },
    columnDsl.field('exportBizName', '导出业务', {
      size: 180,
      filter: 'text',
      filterPlaceholder: '搜索导出业务'
    }),
    columnDsl.field('querySnapshotSummary', '导出摘要', {
      size: 180,
      cellClassName: 'max-w-[180px]'
    }),
    {
      accessorKey: 'status',
      header: ({ column }) => dataTableHeader(column, '状态'),
      size: 120,
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => {
        const label = getStatusLabel(row.original);
        return <Badge variant={getStatusBadgeVariant(row.original)}>{label}</Badge>;
      }
    },
    columnDsl.field('fileType', '类型', {
      size: 100
    }),
    columnDsl.field('fileSize', '大小', {
      type: 'fileSize',
      size: 100
    }),
    {
      accessorKey: 'downloadCount',
      header: ({ column }) => dataTableHeader(column, '下载次数'),
      size: 110,
      enableSorting: true,
      cell: ({ row }) => row.original.downloadCount ?? 0
    },
    ...auditColumns<ExportRecordRecord>()
  ];
}

export default function ExportCenterManagementPage() {
  const exportStatusDict = useDict('EXPORT_RECORD_STATUS');
  const downloadUrlCacheRef = React.useRef<Map<number, CachedDownloadUrl>>(new Map());
  const [detailRecord, setDetailRecord] = React.useState<ExportRecordRecord | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const handleOpenDetail = React.useCallback((record: ExportRecordRecord) => {
    setDetailRecord(record);
    setDetailOpen(true);
  }, []);

  const handleDetailOpenChange = React.useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailRecord(null);
    }
  }, []);

  const getStatusLabel = React.useCallback(
    (record: ExportRecordRecord) => resolveExportStatusLabel(record, exportStatusDict.getLabel),
    [exportStatusDict.getLabel]
  );

  const columns = React.useMemo(
    () => getColumns(handleOpenDetail, getStatusLabel),
    [getStatusLabel, handleOpenDetail]
  );

  const downloadMutationOpts = downloadExportRecordMutationOptions();
  const downloadMutation = useMutation({
    ...downloadMutationOpts,
    onSuccess: async (...args) => {
      await Promise.all([
        downloadMutationOpts.onSuccess?.(...args),
        invalidateExportRecordListQueries()
      ]);
    },
    onError: () => {
      toast.error('获取下载地址失败');
    }
  });

  const getCachedDownloadUrl = React.useCallback((recordId: number) => {
    const cached = downloadUrlCacheRef.current.get(recordId);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now() + DOWNLOAD_URL_CACHE_SKEW_MS) {
      downloadUrlCacheRef.current.delete(recordId);
      return null;
    }

    return cached.url;
  }, []);

  const setCachedDownloadUrl = React.useCallback((recordId: number, downloadUrl: string) => {
    const expiresAt = getTemporaryDownloadUrlExpiresAt(downloadUrl);
    if (expiresAt == null || expiresAt <= Date.now() + DOWNLOAD_URL_CACHE_SKEW_MS) {
      downloadUrlCacheRef.current.delete(recordId);
      return;
    }

    downloadUrlCacheRef.current.set(recordId, {
      url: downloadUrl,
      expiresAt
    });
  }, []);

  const batchDownloadMutationOpts = batchDownloadExportRecordsMutationOptions();
  const batchDownloadMutation = useMutation({
    ...batchDownloadMutationOpts,
    onSuccess: async (...args) => {
      await Promise.all([
        batchDownloadMutationOpts.onSuccess?.(...args),
        invalidateExportRecordListQueries()
      ]);
    },
    onError: () => {
      toast.error('批量下载失败');
    }
  });

  const handleDownload = React.useCallback(
    async (row: ExportRecordRecord) => {
      if (row.recordId == null) {
        toast.error('记录ID不存在，无法下载');
        return;
      }

      if (!isExportRecordReadyForDownload(row)) {
        toast.error('导出未完成，无法下载');
        return;
      }

      const cachedDownloadUrl = getCachedDownloadUrl(row.recordId);
      if (cachedDownloadUrl) {
        downloadFileFromUrl(cachedDownloadUrl, row.fileName);
        return;
      }

      try {
        const data = await downloadMutation.mutateAsync({
          recordId: row.recordId
        });

        if (!data?.downloadUrl) {
          toast.error('后端未返回下载地址');
          return;
        }

        setCachedDownloadUrl(row.recordId, data.downloadUrl);
        downloadFileFromUrl(data.downloadUrl, data.fileName ?? row.fileName);
        toast.success('已获取下载地址');
      } catch {}
    },
    [downloadMutation, getCachedDownloadUrl, setCachedDownloadUrl]
  );

  const handleBatchDownload = React.useCallback(
    async (rows: ExportRecordRecord[]) => {
      if (rows.length === 0) {
        toast.error('请先选择导出记录');
        return false;
      }

      const containsZipRecord = rows.some(isZipExportRecord);
      if (containsZipRecord) {
        toast.error('批量下载不支持选择 zip 文件');
        return false;
      }

      if (rows.some((row) => !isExportRecordReadyForDownload(row))) {
        toast.error('所选记录包含未完成项，请重新选择');
        return false;
      }

      const recordIds = rows.map((row) => row.recordId!);
      if (recordIds.length > 50) {
        toast.error('批量下载最多支持 50 条记录');
        return false;
      }

      try {
        const data = await batchDownloadMutation.mutateAsync({
          ids: recordIds
        });

        if (!data?.downloadUrl) {
          toast.error('后端未返回批量下载地址');
          return false;
        }

        downloadFileFromUrl(data.downloadUrl, data.fileName);
        toast.success(`已打包 ${recordIds.length} 个文件`);
        return true;
      } catch {
        return false;
      }
    },
    [batchDownloadMutation]
  );

  const deleteMutationOpts = deleteExportRecordMutationOptions();
  const deleteMutation = useMutation({
    ...deleteMutationOpts,
    onSuccess: async (...args) => {
      await Promise.all([
        deleteMutationOpts.onSuccess?.(...args),
        invalidateExportRecordListQueries()
      ]);
    },
    onError: () => {
      toast.error('导出记录删除失败');
    }
  });

  const rowActions = React.useMemo<DataTableRowAction<ExportRecordRecord>[]>(
    () => [
      {
        label: '下载',
        icon: <Icons.fileTypeCsv className='size-4' />,
        disabled: (row) => !isExportRecordReadyForDownload(row),
        onClick: handleDownload
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        disabled: (row) => row.recordId == null,
        confirmDelete: {
          title: '确认删除导出记录',
          description: () => '删除后不可恢复，已下载文件不会受影响。',
          confirmText: '确认删除',
          cancelText: '取消'
        },
        onClick: async (row) => {
          if (row.recordId == null) {
            toast.error('记录ID不存在，无法删除');
            return;
          }

          try {
            await deleteMutation.mutateAsync({ ids: [row.recordId] });
          } catch {
            return;
          }

          downloadUrlCacheRef.current.delete(row.recordId);
          toast.success('导出记录已删除');
        }
      }
    ],
    [deleteMutation, handleDownload]
  );

  const { table, total, clearSelectedRows, queryState, refreshProps } = useDslDataTable<
    ExportRecordRecord,
    PageMyExportRecordsQueryRequest,
    PageMyExportRecordsResponse,
    ApiClientError,
    ReturnType<typeof pageMyExportRecordsQueryKey>
  >({
    tableId: TABLE_ID,
    columns,
    queryOptions: pageMyExportRecordsQueryOptions,
    defaultRequestSort: DEFAULT_REQUEST_SORT,
    showSelectColumn: true,
    rowActions,
    rowId: 'recordId',
    refreshBehavior: {
      onSuccess: () => {
        toast.success('导出中心已刷新');
      }
    }
  });

  const handleBatchDelete = React.useCallback(
    async (rows: ExportRecordRecord[]) => {
      if (rows.length === 0) {
        toast.error('请先选择导出记录');
        return false;
      }

      const ids = rows.filter((row) => row.recordId != null).map((row) => row.recordId!);

      if (ids.length === 0) {
        toast.error('所选记录的 ID 不完整');
        return false;
      }

      if (ids.length !== rows.length) {
        toast.error('所选记录包含 ID 不完整项，请重新选择');
        return false;
      }

      try {
        await deleteMutation.mutateAsync({ ids });
        ids.forEach((id) => downloadUrlCacheRef.current.delete(id));
        toast.success(`已删除 ${ids.length} 条记录`);
        return true;
      } catch {
        return false;
      }
    },
    [deleteMutation]
  );

  const { withConfirm, confirmDialog } =
    useConfirmAction<[DataTableActionContext<ExportRecordRecord>]>();

  const tableActions = React.useMemo<DataTableAction<ExportRecordRecord>[]>(
    () => [
      {
        label: '批量下载',
        icon: <Icons.fileZip className='size-3.5' />,
        hidden: (ctx) => ctx.selectedRows.length === 0,
        disabled: batchDownloadMutation.isPending,
        callback: async (ctx) => {
          const completed = await handleBatchDownload(ctx.selectedRows);
          if (completed) {
            clearSelectedRows();
          }
        }
      },
      {
        label: '批量删除',
        icon: <Icons.trash className='size-3.5' />,
        type: 'danger',
        hidden: (ctx) => ctx.selectedRows.length === 0,
        callback: withConfirm({
          title: (ctx) => `确认删除 ${ctx.selectedRows.length} 条导出记录？`,
          description: '删除后不可恢复，已下载文件不会受影响。',
          confirmText: '确认删除',
          cancelText: '取消',
          run: async (ctx) => {
            const completed = await handleBatchDelete(ctx.selectedRows);
            if (completed) {
              clearSelectedRows();
            }
          }
        })
      }
    ],
    [
      batchDownloadMutation.isPending,
      clearSelectedRows,
      handleBatchDownload,
      handleBatchDelete,
      withConfirm
    ]
  );

  const rowCount = table.getRowModel().rows.length;
  const isInitialLoading = queryState.isFetching && !queryState.data;

  if (isInitialLoading && rowCount === 0) {
    return (
      <Card>
        <CardContent className='min-h-0 flex-1 px-0'>
          <DataTableSkeleton columnCount={8} filterCount={2} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className='min-h-0 flex-1 px-0'>
          <DataTable
            table={table}
            statusTotalCount={total}
            isLoading={isInitialLoading}
            tableActions={tableActions}
            {...refreshProps}
            getStatusConfig={({ rows, hasFilters, isLoading: isTableLoading }) => {
              if (!rows.length && !isTableLoading) {
                if (!hasFilters) {
                  return {
                    type: 'empty',
                    title: '暂无导出记录',
                    description: '创建导出任务后可在这里查看。'
                  };
                }

                return {
                  type: 'empty',
                  title: '未找到匹配的导出记录',
                  description: '尝试调整文件名或导出业务筛选条件。'
                };
              }
            }}
          >
            <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
          </DataTable>
        </CardContent>
      </Card>
      {detailRecord ? (
        <ExportRecordDetailSheet
          data={detailRecord}
          open={detailOpen}
          onOpenChange={handleDetailOpenChange}
          getStatusLabel={getStatusLabel}
        />
      ) : null}
      {confirmDialog}
    </>
  );
}
