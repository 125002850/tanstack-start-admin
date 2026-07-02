import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoredFileRspDTO } from '@/lib/api/clients/service';

import { useFileUpload } from './use-file-upload';

const mocks = vi.hoisted(() => ({
  mutationFn: vi.fn(),
  toastPromise: vi.fn((promise: Promise<unknown>) => promise),
  toastError: vi.fn(),
  uploadFileObjectMutationOptions: vi.fn()
}));

vi.mock('@/lib/api/clients/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/clients/service')>();

  return {
    ...actual,
    uploadFileObjectMutationOptions: mocks.uploadFileObjectMutationOptions
  };
});

vi.mock('sonner', () => ({
  toast: {
    promise: mocks.toastPromise,
    error: mocks.toastError
  }
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false
      },
      queries: {
        retry: false
      }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFileUpload', () => {
  beforeEach(() => {
    mocks.mutationFn.mockReset();
    mocks.toastPromise.mockClear();
    mocks.toastError.mockClear();
    mocks.uploadFileObjectMutationOptions.mockReset();
    mocks.uploadFileObjectMutationOptions.mockReturnValue({
      mutationKey: ['service', 'storage-object', 'upload'],
      mutationFn: mocks.mutationFn
    });
  });

  it('uploads a file with bizPath and objectKey through the generated mutation', async () => {
    const storedFile: StoredFileRspDTO = {
      objectKey: 'framework/upload-demo/a.pdf',
      originUrl: 'https://cdn.example.com/a.pdf',
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      size: 3
    };
    mocks.mutationFn.mockResolvedValue(storedFile);
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' });

    const { result } = renderHook(
      () => useFileUpload({ bizPath: 'framework/upload-demo', objectKey: 'custom/a.pdf' }),
      { wrapper: createWrapper() }
    );

    let uploaded: StoredFileRspDTO | undefined;
    await act(async () => {
      uploaded = await result.current.upload(file);
    });

    expect(uploaded).toEqual(storedFile);
    expect(mocks.uploadFileObjectMutationOptions).toHaveBeenCalledTimes(1);
    expect(mocks.mutationFn).toHaveBeenCalledWith(
      {
      params: {
        bizPath: 'framework/upload-demo',
        objectKey: 'custom/a.pdf'
      },
      body: {
        file
      }
      },
      expect.any(Object)
    );
  });

  it('wraps upload with default Chinese toast messages', async () => {
    mocks.mutationFn.mockResolvedValue({ fileName: 'a.pdf' });
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' });

    const { result } = renderHook(() => useFileUpload({ bizPath: 'framework/upload-demo' }), {
      wrapper: createWrapper()
    });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(mocks.toastPromise).toHaveBeenCalledWith(expect.any(Promise), {
      loading: '附件上传中...',
      success: '附件上传成功',
      error: '附件上传失败'
    });
  });

  it('allows custom toast messages and exposes mutation state', async () => {
    let resolveUpload!: (value: StoredFileRspDTO) => void;
    mocks.mutationFn.mockImplementation(
      () =>
        new Promise<StoredFileRspDTO>((resolve) => {
          resolveUpload = resolve;
        })
    );
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' });

    const { result } = renderHook(
      () =>
        useFileUpload({
          bizPath: 'framework/upload-demo',
          toastMessages: {
            loading: '正在上传',
            success: '上传完成',
            error: '上传异常'
          }
        }),
      { wrapper: createWrapper() }
    );

    let promise!: Promise<StoredFileRspDTO>;
    act(() => {
      promise = result.current.upload(file);
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(true);
    });

    resolveUpload({ fileName: 'a.pdf' });
    await act(async () => {
      await promise;
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
    });
    expect(result.current.error).toBeNull();
    expect(mocks.toastPromise).toHaveBeenCalledWith(expect.any(Promise), {
      loading: '正在上传',
      success: '上传完成',
      error: '上传异常'
    });
  });
});
