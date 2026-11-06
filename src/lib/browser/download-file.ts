import { saveAs } from 'file-saver';

export function downloadFileFromUrl(downloadUrl: string, fileName?: string | null) {
  const normalizedFileName = fileName?.trim() || undefined;
  saveAs(downloadUrl, normalizedFileName);
}
