import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import {
  DATA_TABLE_EXPORT_MAX_ROWS,
  DataTableExportDialog,
  type DataTableExportDialogLabels,
  type DataTableExportRange
} from '@/components/ui/table/export/data-table-export-dialog';
import type {
  DataTableAction,
  DataTableActionContext
} from '@/components/ui/table/actions/data-table-actions-bar';
import { downloadFileFromUrl } from '@/lib/download-file';

/**
 * DataTable 导出操作 hook。
 *
 * 生成可直接传给 DataTableActionsBar 的“导出”下拉操作，并按总数自动选择：
 * - 选中行导出；
 * - 小数据量直接导出全部；
 * - 大数据量弹出区间/打包导出弹窗。
 */
export type { DataTableExportRange } from '@/components/ui/table/export/data-table-export-dialog';

/** 后端导出接口的最小返回结构：下载地址必需，文件名可选。 */
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

/** 把业务请求与通用导出选项组合，便于后端识别区间或打包模式。 */
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

/** UI 区间是 1-based 序号，直接映射为后端请求可读的 startRow/endRow。 */
export function toDataTableExportRequestRange(
  range: DataTableExportRange
): DataTableExportRequestRange {
  return {
    startRow: range.start,
    endRow: range.end
  };
}

/** 给任意业务请求追加区间导出参数。 */
export function withDataTableExportRange<TRequest extends object>(
  request: TRequest,
  range: DataTableExportRange
): DataTableExportRequestWithOptions<TRequest> {
  return {
    ...request,
    range: toDataTableExportRequestRange(range)
  };
}

/** 给任意业务请求追加打包导出参数；默认 chunkSize 与单次最大导出数一致。 */
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
          // 后端成功响应但没有下载地址时，不假定成功，直接提示用户。
          toast.error(missingDownloadUrlMessage);
          return false;
        }

        downloadFileFromUrl(data.downloadUrl, data.fileName);
        toast.success(successMessage);
        return true;
      } catch {
        // 具体错误提示由调用路径决定；这里返回 false，让上层控制 toast 文案。
        return false;
      }
    },
    [messages?.missingDownloadUrl, messages?.success, submitExport]
  );

  const handleExportSelected = React.useCallback(
    async (selectedRows: TData[]) => {
      const keys = getSelectedKeys(selectedRows);

      if (keys.length === 0) {
        // 选中行可能被过滤成无效 key，例如缺少业务主键。
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
      // 超过单次上限时进入区间/打包弹窗，避免一次请求过大。
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
          // buildRangeRequest 可返回空值表示当前区间无数据或业务方主动取消。
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
        // 打包导出也允许调用方在运行时判断“当前无可导出数据”。
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
          ...(showSelectedAction
            ? [
                {
                  kind: 'selection' as const,
                  label: '导出选中',
                  icon: <Icons.fileTypeCsv className='size-3.5' />,
                  callback: async (ctx: DataTableActionContext<TData>) => {
                    await handleExportSelected(ctx.selectedRows);
                  }
                }
              ]
            : []),
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
