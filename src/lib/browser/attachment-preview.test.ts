import { expect, it } from 'vitest';
import { imageContentType, isImageFile, isSafeAttachmentUrl } from './attachment-preview';

it('优先使用明确的 MIME，仅在缺失或通用二进制类型时按文件名识别图片', () => {
  expect(imageContentType({ filename: '签收.PNG' })).toBe('image/png');
  expect(imageContentType({ filename: '签收.avif', contentType: 'application/octet-stream' })).toBe(
    'image/avif'
  );
  expect(isImageFile({ filename: '伪装.png', contentType: 'application/pdf' })).toBe(false);
  expect(isImageFile({ filename: '无扩展名', contentType: 'image/webp; charset=binary' })).toBe(
    true
  );
  expect(isImageFile({ filename: '报告.pdf' })).toBe(false);
});

it('无文件扩展名的 data 图片也可识别，非图片 data 不进入图片预览', () => {
  expect(isImageFile({ filename: '图片', url: 'data:image/png;base64,abc' })).toBe(true);
  expect(isImageFile({ filename: '图片', url: 'data:image/svg+xml,<svg/>' })).toBe(true);
  expect(isImageFile({ filename: '文档', url: 'data:application/pdf;base64,abc' })).toBe(false);
});

it.each([
  undefined,
  '',
  '/relative.png',
  'javascript:alert(1)',
  'data:image/png;base64,abc',
  'https://user:password@example.test/image.png',
  'https://user@example.test/image.png'
])('外部附件不接受不可用地址或嵌入凭据：%s', (url) => {
  expect(isSafeAttachmentUrl(url)).toBe(false);
});

it('保留 HTTP(S) 签名链接的查询参数', () => {
  expect(isSafeAttachmentUrl('https://files.example.test/photo.png?signature=original')).toBe(true);
  expect(isSafeAttachmentUrl('http://files.example.test/photo.png')).toBe(true);
});
