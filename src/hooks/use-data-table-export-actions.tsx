import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { EXPORT_RECORD_STATUS } from '@/constants/enums';
import {
  DATA_TABLE_EXPORT_MAX_ROWS,
  DataTableExportDialog,
  type DataTableExportDialogLabels,
  type DataTableExportRange
} from '@/components/data-table/export/data-table-export-dialog';
import type { DataTableAction, DataTableActionContext } from '@/types/data-table';
import { downloadFileFromUrl } from '@/lib/browser/download-file';
import { waitForExportDownload } from '@/lib/api/clients/service/adapters/export-download';
import { normalizeApiError } from '@/lib/api/error-normalizer';

const EXPORT_AUTO_DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * DataTable 导出操作 hook。
 *
 * 生成可直接传给 DataTableActionsBar 的“导出”下拉操作，并按总数自动选择：
 * - 选中行导出；
 * - 小数据量直接导出全部；
 * - 大数据量弹出区间/打包导出弹窗。
 */
export type { DataTableExportRange } from '@/components/data-table/export/data-table-export-dialog';

/** 兼容同步下载与导出中心的异步提交响应。 */
export interface DataTableExportResponse {
  recordId?: number | null;
  downloadUrl?: string | null;
  fileName?: string | null;
  status?: string | number | null;
  statusName?: string | null;
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
  submitted?: string;
}

interface UseDataTableExportActionsOptions<TData, TRequest, TSelectedKey> {
  total: number;
  /** 导出内容名称，追加到“选中导出”和“全部导出”菜单文案。 */
  exportContentLabel?: string;
  maxRows?: number;
  disabled?: boolean;
  disabledReason?: string;
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
  exportContentLabel = '',
  maxRows = DATA_TABLE_EXPORT_MAX_ROWS,
  disabled = false,
  disabledReason,
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
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingExportAction>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const activeExportRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => activeExportRef.current?.abort(), []);

  const exportAndDownload = React.useCallback(
    async (
      request: TRequest,
      submit: ExportSubmitter<TRequest> = submitExport,
      successMessage = messages?.success ?? '导出已开始下载',
      missingDownloadUrlMessage = messages?.missingDownloadUrl ?? '后端未返回下载地址'
    ) => {
      if (activeExportRef.current) return false;
      const controller = new AbortController();
      activeExportRef.current = controller;
      setIsExporting(true);
      let loadingToastId: string | number | undefined;
      let waitingForExport = false;
      let timeoutSignal: AbortSignal | undefined;
      try {
        let data: DataTableExportResponse | null | undefined;
        try {
          data = await submit(request);
        } catch {
          // 提交失败沿用调用方 Mutation 的统一错误出口。
          return false;
        }
        controller.signal.throwIfAborted();

        if (data?.status === EXPORT_RECORD_STATUS.PROCESSING || data?.statusName === 'PROCESSING') {
          if (data.recordId == null) {
            toast.error('后端未返回导出记录编号，无法等待下载');
            return false;
          }
          waitingForExport = true;
          loadingToastId = toast.loading(messages?.submitted ?? '正在生成导出文件，完成后自动下载');
          timeoutSignal = AbortSignal.timeout(EXPORT_AUTO_DOWNLOAD_TIMEOUT_MS);
          data = await waitForExportDownload(
            data.recordId,
            AbortSignal.any([controller.signal, timeoutSignal])
          );
          controller.signal.throwIfAborted();
        }

        if (data?.status === EXPORT_RECORD_STATUS.FAILED || data?.statusName === 'FAILED') {
          toast.error('导出失败，请到导出中心查看记录后重试');
          return false;
        }

        if (!data?.downloadUrl) {
          // 后端成功响应但没有下载地址时，不假定成功，直接提示用户。
          toast.error(missingDownloadUrlMessage);
          return false;
        }

        await downloadFileFromUrl(data.downloadUrl, data.fileName);
        toast.success(successMessage);
        return true;
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(
            timeoutSignal?.aborted
              ? '等待导出超时，请稍后到导出中心查看并下载'
              : normalizeApiError(error, {
                  fallbackMessage: '导出下载失败，请到导出中心查看并下载'
                }).message
          );
        }
        return false;
      } finally {
        if (loadingToastId != null) toast.dismiss(loadingToastId);
        if (waitingForExport) {
          await queryClient.invalidateQueries({ queryKey: ['service', 'export-my'] });
        }
        activeExportRef.current = null;
        setIsExporting(false);
      }
    },
    [
      messages?.missingDownloadUrl,
      messages?.submitted,
      messages?.success,
      queryClient,
      submitExport
    ]
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
        disabled: disabled || isExporting,
        disabledReason: isExporting ? '正在导出，完成后自动下载。' : disabledReason,
        children: [
          ...(showSelectedAction
            ? [
                {
                  kind: 'selection' as const,
                  label: `选中导出${exportContentLabel}`,
                  icon: <Icons.fileTypeCsv className='size-3.5' />,
                  disabled: disabled || isExporting,
                  disabledReason: isExporting ? '正在导出，完成后自动下载。' : disabledReason,
                  callback: async (ctx: DataTableActionContext<TData>) => {
                    await handleExportSelected(ctx.selectedRows);
                  }
                }
              ]
            : []),
          {
            label: `全部导出${exportContentLabel}`,
            icon: <Icons.fileTypeCsv className='size-3.5' />,
            disabled: disabled || isExporting,
            disabledReason: isExporting ? '正在导出，完成后自动下载。' : disabledReason,
            callback: handleExportAll
          }
        ]
      }
    ],
    [
      disabled,
      disabledReason,
      isExporting,
      exportContentLabel,
      handleExportAll,
      handleExportSelected,
      showSelectedAction
    ]
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
