import { useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  uploadFileObjectMutationOptions,
  type StoredFileRspDTO
} from '@/lib/api/clients/service';

type FileUploadToastMessages = {
  loading: string;
  success: string;
  error: string;
};

type UseFileUploadOptions = {
  bizPath: string;
  objectKey?: string;
  toastMessages?: Partial<FileUploadToastMessages>;
  accept?: string[];
  maxSize?: number;
};

const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.doc',
  '.docx',
  '.pdf',
  '.xls',
  '.xlsx',
  '.csv'
];

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const defaultToastMessages: FileUploadToastMessages = {
  loading: '附件上传中...',
  success: '附件上传成功',
  error: '附件上传失败'
};

export function useFileUpload({ bizPath, objectKey, toastMessages, accept, maxSize }: UseFileUploadOptions) {
  const uploadMutation = useMutation(uploadFileObjectMutationOptions());
  const messages = useMemo(
    () => ({
      ...defaultToastMessages,
      ...toastMessages
    }),
    [toastMessages]
  );

      const allowedExtensions = useMemo(
    () => (accept?.length ? accept : ALLOWED_EXTENSIONS),
    [accept]
  );

  const resolvedMaxSize = maxSize ?? MAX_FILE_SIZE;
  const sizeLabel = resolvedMaxSize >= 1024 * 1024
    ? `${resolvedMaxSize / (1024 * 1024)}MB`
    : `${Math.round(resolvedMaxSize / 1024)}KB`;

  const upload = useCallback(
    (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        const allowedList = allowedExtensions.join('、');
        toast.error(`不支持的文件类型，仅允许上传 ${allowedList} 格式的文件`);
        return Promise.reject(new Error(`不支持的文件类型: ${ext}`));
      }

      if (file.size > resolvedMaxSize) {
        toast.error(`文件大小不能超过 ${sizeLabel}`);
        return Promise.reject(new Error('文件大小超过限制'));
      }

      const uploadPromise = uploadMutation.mutateAsync({
        params: {
          bizPath,
          objectKey
        },
        body: {
          file
        }
      });

      toast.promise(uploadPromise, messages);

      return uploadPromise as Promise<StoredFileRspDTO>;
    },
    [bizPath, messages, objectKey, uploadMutation, allowedExtensions, resolvedMaxSize, sizeLabel]
  );

  return {
    upload,
    isUploading: uploadMutation.isPending,
    error: uploadMutation.error
  };
}
