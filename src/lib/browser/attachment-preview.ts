const imageTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  apng: 'image/apng',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif'
};

export function imageContentType(file: { filename?: string; contentType?: string }) {
  const type = file.contentType?.split(';')[0].trim().toLowerCase();
  if (type && /^image\/[a-z0-9.+-]+$/.test(type)) return type;
  if (type && type !== 'application/octet-stream' && type !== 'binary/octet-stream') return;
  const extension = file.filename?.split('.').pop()?.toLowerCase() ?? '';
  return Object.hasOwn(imageTypes, extension) ? imageTypes[extension] : undefined;
}

export function isImageFile(file: { filename?: string; contentType?: string; url?: string }) {
  const dataType = file.url?.match(/^data:(image\/[a-z0-9.+-]+)[;,]/i)?.[1];
  return Boolean(imageContentType({ ...file, contentType: file.contentType || dataType }));
}

/** 外部附件沿用 HTTP(S)、无嵌入凭据的访问边界。 */
export function isSafeAttachmentUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.host.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}
