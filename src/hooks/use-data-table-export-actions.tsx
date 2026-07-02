import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import {
  DATA_TABLE_EXPORT_MAX_ROWS,
  DataTableExportDialog,
  type DataTableExportDialogLabels,
  type DataTableExportRange
} from '@/components/ui/table/data-table-export-dialog';
import type { DataTableAction } from '@/components/ui/table/data-table-actions-bar';
import { downloadFileFromUrl } from '@/lib/download-file';

export type { DataTableExportRange } from '@/components/ui/table/data-table-export-dialog';

export interface DataTableExportResponse {
  downloadUrl?: string | null;
  fileName?: string | null;
}

export interface DataTableExportRequestRange {
  startRow?: number;
  endRow?: number;
}

export interface DataTableExportRequestOptions {
  range?: DataTableExportRequestRange;
  packageMode?: boolean;
  chunkSize?: number;
}

export type DataTableExportRequestWithOptions<TRequest> = TRequest & DataTableExportRequestOptions;

type ExportSubmitter<TRequest> = (
  request: TRequest
) => Promise<DataTableExportResponse | null | undefined>;

interface DataTablePackageExportOptions<TRequest> {
  buildRequest: () => TRequest | Promise<TRequest | null | undefined> | null | undefined;
  submitExport?: ExportSubmitter<TRequest>;
  successMessage?: string;
  missingDownloadUrlMessage?: string;
  errorMessage?: string;
}

interface UseDataTableExportActionsMessages {
  selectedEmpty?: string;
  rangeEmpty?: string;
  rangeError?: string;
  missingDownloadUrl?: string;
  success?: string;
}

interface UseDataTableExportActionsOptions<TData, TRequest, TSelectedKey> {
  total: number;
  maxRows?: number;
  disabled?: boolean;
  showSelectedAction?: boolean;
  getSelectedKeys: (rows: TData[]) => TSelectedKey[];
  buildSelectedRequest: (keys: TSelectedKey[]) => TRequest;
  buildAllRequest: () => TRequest;
  buildRangeRequest?: (
    range: DataTableExportRange
  ) => TRequest | Promise<TRequest | null | undefined> | null | undefined;
  submitExport: ExportSubmitter<TRequest>;
  clearSelectedRows?: () => void;
  packageExport?: DataTablePackageExportOptions<TRequest>;
  messages?: UseDataTableExportActionsMessages;
  dialogLabels?: DataTableExportDialogLabels;
}

type PendingExportAction = 'range' | 'package' | null;

export function toDataTableExportRequestRange(
  range: DataTableExportRange
): DataTableExportRequestRange {
  return {
    startRow: range.start,
    endRow: range.end
  };
}

export function withDataTableExportRange<TRequest extends object>(
  request: TRequest,
  range: DataTableExportRange
): DataTableExportRequestWithOptions<TRequest> {
  return {
    ...request,
    range: toDataTableExportRequestRange(range)
  };
}

export function withDataTablePackageMode<TRequest extends object>(
  request: TRequest,
  chunkSize = DATA_TABLE_EXPORT_MAX_ROWS
): DataTableExportRequestWithOptions<TRequest> {
  return {
    ...request,
    packageMode: true,
    chunkSize
  };
}

export function useDataTableExportActions<TData, TRequest, TSelectedKey>({
  total,
  maxRows = DATA_TABLE_EXPORT_MAX_ROWS,
  disabled = false,
  showSelectedAction = true,
  getSelectedKeys,
  buildSelectedRequest,
  buildAllRequest,
  buildRangeRequest,
  submitExport,
  clearSelectedRows,
  packageExport,
  messages,
  dialogLabels
}: UseDataTableExportActionsOptions<TData, TRequest, TSelectedKey>) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingExportAction>(null);

  const exportAndDownload = React.useCallback(
    async (
      request: TRequest,
      submit: ExportSubmitter<TRequest> = submitExport,
      successMessage = messages?.success ?? '导出已开始下载',
      missingDownloadUrlMessage = messages?.missingDownloadUrl ?? '后端未返回下载地址'
    ) => {
      try {
        const data = await submit(request);

        if (!data?.downloadUrl) {
          toast.error(missingDownloadUrlMessage);
          return false;
        }

        downloadFileFromUrl(data.downloadUrl, data.fileName);
        toast.success(successMessage);
        return true;
      } catch {
        return false;
      }
    },
    [messages?.missingDownloadUrl, messages?.success, submitExport]
  );

  const handleExportSelected = React.useCallback(
    async (selectedRows: TData[]) => {
      const keys = getSelectedKeys(selectedRows);

      if (keys.length === 0) {
        toast.error(messages?.selectedEmpty ?? '未选中有效记录');
        return;
      }

      const completed = await exportAndDownload(buildSelectedRequest(keys));
      if (completed) {
        clearSelectedRows?.();
      }
    },
    [
      buildSelectedRequest,
      clearSelectedRows,
      exportAndDownload,
      getSelectedKeys,
      messages?.selectedEmpty
    ]
  );

  const handleExportAll = React.useCallback(async () => {
    if (total > maxRows) {
      setDialogOpen(true);
      return;
    }

    await exportAndDownload(buildAllRequest());
  }, [buildAllRequest, exportAndDownload, maxRows, total]);

  const handleConfirmRange = React.useCallback(
    async (range: DataTableExportRange) => {
      if (!buildRangeRequest) return;

      setPendingAction('range');

      try {
        const request = await buildRangeRequest(range);

        if (!request) {
          toast.error(messages?.rangeEmpty ?? '所选区间没有可导出的记录');
          return;
        }

        const completed = await exportAndDownload(request);
        if (completed) {
          setDialogOpen(false);
        }
      } catch {
        toast.error(messages?.rangeError ?? '导出区间查询失败');
      } finally {
        setPendingAction(null);
      }
    },
    [buildRangeRequest, exportAndDownload, messages?.rangeEmpty, messages?.rangeError]
  );

  const handlePackageExport = React.useCallback(async () => {
    if (!packageExport) return;

    setPendingAction('package');

    try {
      const request = await packageExport.buildRequest();

      if (!request) {
        toast.error(messages?.rangeEmpty ?? '当前结果没有可导出的记录');
        return;
      }

      const completed = await exportAndDownload(
        request,
        packageExport.submitExport ?? submitExport,
        packageExport.successMessage ?? messages?.success ?? '打包导出已开始下载',
        packageExport.missingDownloadUrlMessage ??
          messages?.missingDownloadUrl ??
          '后端未返回下载地址'
      );
      if (completed) {
        setDialogOpen(false);
      }
    } catch {
      toast.error(packageExport.errorMessage ?? '打包导出失败');
    } finally {
      setPendingAction(null);
    }
  }, [
    exportAndDownload,
    messages?.missingDownloadUrl,
    messages?.rangeEmpty,
    messages?.success,
    packageExport,
    submitExport
  ]);

  const actions = React.useMemo<DataTableAction<TData>[]>(
    () => [
      {
        label: '导出',
        icon: <Icons.fileTypeCsv className='size-3.5' />,
        disabled,
        children: [
          {
            label: '导出选中',
            icon: <Icons.fileTypeCsv className='size-3.5' />,
            hidden: (ctx) => !showSelectedAction || ctx.selectedRows.length === 0,
            callback: async (ctx) => {
              await handleExportSelected(ctx.selectedRows);
            }
          },
          {
            label: '导出全部',
            icon: <Icons.fileTypeCsv className='size-3.5' />,
            callback: handleExportAll
          }
        ]
      }
    ],
    [disabled, handleExportAll, handleExportSelected, showSelectedAction]
  );

  const exportDialog = (
    <DataTableExportDialog
      open={dialogOpen}
      total={total}
      maxRows={maxRows}
      rangeSubmitting={pendingAction === 'range'}
      packageSubmitting={pendingAction === 'package'}
      labels={dialogLabels}
      onOpenChange={setDialogOpen}
      onConfirmRange={buildRangeRequest ? handleConfirmRange : undefined}
      onPackageExport={packageExport ? handlePackageExport : undefined}
    />
  );

  return {
    actions,
    exportDialog,
    exportAndDownload
  };
}
