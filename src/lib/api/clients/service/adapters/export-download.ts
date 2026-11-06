import { EXPORT_RECORD_STATUS } from '@/constants/enums';
import { detailExportRecord, downloadExportRecord } from '../generated/sdk';
import type { ExportSubmitRspDTO } from '../generated/model/exportSubmitRspDTO';

const EXPORT_POLL_INTERVAL_MS = 1000;

function waitForNextPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, EXPORT_POLL_INTERVAL_MS);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** 等待已提交的导出完成，再获取同一份文件的下载地址；不重新生成文件。 */
export async function waitForExportDownload(
  recordId: number,
  signal: AbortSignal
): Promise<ExportSubmitRspDTO | null | undefined> {
  while (true) {
    signal.throwIfAborted();
    const record = await detailExportRecord({ recordId }, { signal });
    signal.throwIfAborted();

    if (record?.status === EXPORT_RECORD_STATUS.SUCCESS) {
      const file = await downloadExportRecord({ recordId }, { signal });
      signal.throwIfAborted();
      return {
        ...record,
        downloadUrl: file?.downloadUrl,
        fileName: file?.fileName ?? record.fileName
      };
    }

    if (record?.status !== EXPORT_RECORD_STATUS.PROCESSING) {
      return record;
    }

    await waitForNextPoll(signal);
  }
}
