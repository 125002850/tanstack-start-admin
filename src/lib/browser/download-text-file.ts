import { saveAs } from 'file-saver';

/** 将文本内容保存为本地文件。 */
export function downloadTextFile(
  content: string,
  fileName?: string | null,
  mimeType = 'text/plain;charset=utf-8'
) {
  saveAs(new Blob([content], { type: mimeType }), fileName?.trim() || undefined);
}
