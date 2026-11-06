import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXPORT_RECORD_STATUS } from '@/constants/enums';
import { detailExportRecord, downloadExportRecord } from '../generated/sdk';
import { waitForExportDownload } from './export-download';

vi.mock('../generated/sdk', () => ({
  detailExportRecord: vi.fn(),
  downloadExportRecord: vi.fn()
}));

describe('waitForExportDownload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(detailExportRecord).mockReset();
    vi.mocked(downloadExportRecord)
      .mockReset()
      .mockResolvedValue({ downloadUrl: '/mock-files/export.xlsx' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('等待多次处理中响应，成功后只获取一次同一记录的下载地址', async () => {
    vi.mocked(detailExportRecord)
      .mockResolvedValueOnce({ status: EXPORT_RECORD_STATUS.PROCESSING })
      .mockResolvedValueOnce({ status: '1' })
      .mockResolvedValueOnce({
        recordId: 9001,
        status: EXPORT_RECORD_STATUS.SUCCESS,
        fileName: '关联.xlsx'
      });
    const signal = new AbortController().signal;
    const result = waitForExportDownload(9001, signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(detailExportRecord).toHaveBeenCalledTimes(1);
    expect(downloadExportRecord).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(999);
    expect(detailExportRecord).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1001);

    await expect(result).resolves.toMatchObject({
      recordId: 9001,
      fileName: '关联.xlsx',
      downloadUrl: '/mock-files/export.xlsx'
    });
    expect(detailExportRecord).toHaveBeenCalledTimes(3);
    expect(detailExportRecord).toHaveBeenLastCalledWith({ recordId: 9001 }, { signal });
    expect(downloadExportRecord).toHaveBeenCalledExactlyOnceWith({ recordId: 9001 }, { signal });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('成功状态名可直接下载，并优先使用下载响应的文件名', async () => {
    vi.mocked(detailExportRecord).mockResolvedValue({ status: '2', fileName: '旧名' });
    vi.mocked(downloadExportRecord).mockResolvedValue({
      fileName: '关联.xlsx',
      downloadUrl: '/mock-files/export.xlsx'
    });
    await expect(waitForExportDownload(9001, new AbortController().signal)).resolves.toMatchObject({
      fileName: '关联.xlsx',
      downloadUrl: '/mock-files/export.xlsx'
    });
  });

  it('生成失败时终止等待，不获取下载地址', async () => {
    const failed = { status: EXPORT_RECORD_STATUS.FAILED };
    vi.mocked(detailExportRecord).mockResolvedValue(failed);
    await expect(waitForExportDownload(9001, new AbortController().signal)).resolves.toEqual(
      failed
    );
    expect(downloadExportRecord).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('查询失败时结束等待，将错误交给调用方处理', async () => {
    const error = { response: { status: 403 } };
    vi.mocked(detailExportRecord).mockRejectedValue(error);
    await expect(waitForExportDownload(9001, new AbortController().signal)).rejects.toBe(error);
    expect(downloadExportRecord).not.toHaveBeenCalled();
  });

  it('取消等待会清理轮询计时器，不继续查询或下载', async () => {
    vi.mocked(detailExportRecord).mockResolvedValue({ status: '1' });
    const controller = new AbortController();
    const result = waitForExportDownload(9001, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(5000);
    expect(detailExportRecord).toHaveBeenCalledTimes(1);
    expect(downloadExportRecord).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('取消后收到迟到的成功响应，也不获取下载地址', async () => {
    let complete!: (value: { status: '2' }) => void;
    vi.mocked(detailExportRecord).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const controller = new AbortController();
    const result = waitForExportDownload(9001, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    complete({ status: '2' });
    await rejected;
    expect(downloadExportRecord).not.toHaveBeenCalled();
  });
});
