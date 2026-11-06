import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { waitForExportDownload } from '@/lib/api/clients/service/adapters/export-download';
import type { ExportSubmitRspDTO } from '@/lib/api/clients/service/generated/model/exportSubmitRspDTO';
import { downloadFileFromUrl } from '@/lib/browser/download-file';
import {
  useDataTableExportActions,
  type DataTableExportResponse
} from './use-data-table-export-actions';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'export-loading'),
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));
vi.mock('@/lib/api/clients/service/adapters/export-download', () => ({
  waitForExportDownload: vi.fn()
}));
vi.mock('@/lib/browser/download-file', () => ({ downloadFileFromUrl: vi.fn() }));

function setup(submitExport = vi.fn<() => Promise<DataTableExportResponse>>()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const exportKey = ['service', 'export-my', 'test'];
  client.setQueryData(exportKey, []);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(
      () =>
        useDataTableExportActions({
          total: 1,
          getSelectedKeys: (rows: number[]) => rows,
          buildSelectedRequest: (ids) => ({ ids }),
          buildAllRequest: () => ({}),
          submitExport
        }),
      { wrapper }
    ),
    client,
    exportKey,
    submitExport
  };
}

describe('useDataTableExportActions 自动下载', () => {
  beforeEach(() => {
    vi.mocked(waitForExportDownload).mockReset();
    vi.mocked(downloadFileFromUrl).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('同步响应仍直接下载，不查询导出状态', async () => {
    const { result, submitExport } = setup();
    submitExport.mockResolvedValue({
      downloadUrl: '/mock-files/export.xlsx',
      fileName: '关联.xlsx'
    });
    await act(async () => {
      expect(await result.current.exportAndDownload({})).toBe(true);
    });
    expect(downloadFileFromUrl).toHaveBeenCalledExactlyOnceWith(
      '/mock-files/export.xlsx',
      '关联.xlsx'
    );
    expect(waitForExportDownload).not.toHaveBeenCalled();
  });

  it('异步生成成功后自动下载，等待期间阻止其他入口重复提交，结束后刷新导出中心', async () => {
    let complete!: (value: ExportSubmitRspDTO) => void;
    vi.mocked(waitForExportDownload).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const { result, submitExport, client, exportKey } = setup();
    submitExport.mockResolvedValue({ recordId: 9001, status: '1' });
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = result.current.exportAndDownload({});
    });
    expect(result.current.actions[0].disabled).toBe(true);
    expect(result.current.actions[0].children?.every((action) => action.disabled === true)).toBe(
      true
    );
    expect(downloadFileFromUrl).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.exportAndDownload({})).toBe(false);
    });
    expect(submitExport).toHaveBeenCalledTimes(1);
    await act(async () => {
      complete({
        status: '2',
        downloadUrl: '/mock-files/export.xlsx',
        fileName: '关联.xlsx'
      });
      expect(await pending).toBe(true);
    });
    expect(waitForExportDownload).toHaveBeenCalledWith(9001, expect.any(AbortSignal));
    expect(downloadFileFromUrl).toHaveBeenCalledExactlyOnceWith(
      '/mock-files/export.xlsx',
      '关联.xlsx'
    );
    expect(client.getQueryState(exportKey)?.isInvalidated).toBe(true);
    expect(result.current.actions[0].disabled).toBe(false);
    expect(toast.dismiss).toHaveBeenCalledWith('export-loading');
  });

  it('异步生成失败时不下载，结束等待并刷新失败记录', async () => {
    vi.mocked(waitForExportDownload).mockResolvedValue({ status: '3' });
    const { result, submitExport, client, exportKey } = setup();
    submitExport.mockResolvedValue({ recordId: 9001, status: '1' });
    await act(async () => {
      expect(await result.current.exportAndDownload({})).toBe(false);
    });
    expect(downloadFileFromUrl).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('导出失败，请到导出中心查看记录后重试');
    expect(client.getQueryState(exportKey)?.isInvalidated).toBe(true);
    expect(result.current.actions[0].disabled).toBe(false);
  });

  it('查询失败通过统一错误归一化提示，不重新提交任务', async () => {
    vi.mocked(waitForExportDownload).mockRejectedValue({ response: { status: 403 } });
    const { result, submitExport } = setup();
    submitExport.mockResolvedValue({ recordId: 9001, status: '1' });
    await act(async () => {
      expect(await result.current.exportAndDownload({})).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith('你没有执行此操作的权限。');
    expect(submitExport).toHaveBeenCalledTimes(1);
    expect(downloadFileFromUrl).not.toHaveBeenCalled();
    expect(result.current.actions[0].disabled).toBe(false);
  });

  it('超过等待时限会提示从导出中心下载，并恢复导出入口', async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal);
    vi.mocked(waitForExportDownload).mockImplementationOnce(
      (_id, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        })
    );
    const { result, submitExport } = setup();
    submitExport.mockResolvedValue({ recordId: 9001, status: '1' });
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = result.current.exportAndDownload({});
    });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(10 * 60 * 1000);
    await act(async () => {
      timeoutController.abort(new DOMException('Timed out', 'TimeoutError'));
      expect(await pending).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith('等待导出超时，请稍后到导出中心查看并下载');
    expect(downloadFileFromUrl).not.toHaveBeenCalled();
    expect(result.current.actions[0].disabled).toBe(false);
  });

  it('离开页面时取消等待，迟到的成功响应不再触发下载', async () => {
    let complete!: (value: ExportSubmitRspDTO) => void;
    vi.mocked(waitForExportDownload).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const { result, submitExport, unmount } = setup();
    submitExport.mockResolvedValue({ recordId: 9001, status: '1' });
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = result.current.exportAndDownload({});
    });
    const signal = vi.mocked(waitForExportDownload).mock.calls[0][1];
    unmount();
    expect(signal.aborted).toBe(true);
    complete({ status: '2', downloadUrl: '/mock-files/export.xlsx' });
    expect(await pending).toBe(false);
    expect(downloadFileFromUrl).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith('export-loading');
  });

  it('处理中但缺少记录编号时不误报成功', async () => {
    const { result, submitExport } = setup();
    submitExport.mockResolvedValue({ status: '1' });
    await act(async () => {
      expect(await result.current.exportAndDownload({})).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith('后端未返回导出记录编号，无法等待下载');
    expect(waitForExportDownload).not.toHaveBeenCalled();
    expect(downloadFileFromUrl).not.toHaveBeenCalled();
  });
});
