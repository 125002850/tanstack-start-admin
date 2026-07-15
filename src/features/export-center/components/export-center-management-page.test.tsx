import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXPORT_RECORD_STATUS } from '@/constants/enums';

const serviceMocks = vi.hoisted(() => ({
  pageMyExportRecordsQueryOptions: vi.fn(),
  detailExportRecordQueryOptions: vi.fn(),
  downloadExportRecordMutationOptions: vi.fn(),
  batchDownloadExportRecordsMutationOptions: vi.fn(),
  deleteExportRecordMutationOptions: vi.fn()
}));

const mutationMocks = vi.hoisted(() => ({
  downloadMutation: { mutationFn: vi.fn(), onSuccess: vi.fn() },
  batchDownloadMutation: { mutationFn: vi.fn(), onSuccess: vi.fn() },
  deleteMutation: { mutationFn: vi.fn(), onSuccess: vi.fn() }
}));

const downloadFileMocks = vi.hoisted(() => ({
  downloadFileFromUrl: vi.fn()
}));

vi.mock('@/lib/download-file', () => ({
  downloadFileFromUrl: downloadFileMocks.downloadFileFromUrl
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
    viewportProps
  }: {
    children: React.ReactNode;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: Record<string, unknown>;
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined;

    return React.createElement(
      'div',
      { 'data-testid': 'scroll-area' },
      React.createElement(
        'div',
        {
          ref: (node: HTMLDivElement | null) => {
            if (node) {
              Object.defineProperty(node, 'clientHeight', { configurable: true, value: 480 });
              Object.defineProperty(node, 'clientWidth', { configurable: true, value: 1440 });
              Object.defineProperty(node, 'offsetHeight', { configurable: true, value: 480 });
              Object.defineProperty(node, 'offsetWidth', { configurable: true, value: 1440 });
              node.getBoundingClientRect = () =>
                ({
                  x: 0,
                  y: 0,
                  top: 0,
                  left: 0,
                  right: 1440,
                  bottom: 480,
                  width: 1440,
                  height: 480,
                  toJSON: () => ({})
                }) as DOMRect;
            }

            if (typeof viewportRef === 'function') {
              viewportRef(node);
            } else if (viewportRef && 'current' in viewportRef) {
              viewportRef.current = node;
            }
          },
          'data-scroll-target-id': id,
          'data-testid': 'scroll-viewport'
        },
        children
      )
    );
  }
}));

vi.mock('@/hooks/use-dict', () => ({
  useDict: () => ({
    options: [
      { value: '1', label: '处理中' },
      { value: '2', label: '成功' },
      { value: '3', label: '失败' }
    ],
    getLabel: (code: string) =>
      (
        ({
          '1': '处理中',
          '2': '成功',
          '3': '失败'
        }) as Record<string, string>
      )[code] ?? code,
    getCode: vi.fn(),
    refresh: vi.fn(),
    loading: false,
    isEmpty: false
  })
}));

vi.mock('@/lib/api/clients/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/clients/service')>();

  return {
    ...actual,
    pageMyExportRecordsQueryOptions: (...args: unknown[]) =>
      serviceMocks.pageMyExportRecordsQueryOptions(...args),
    detailExportRecordQueryOptions: (...args: unknown[]) =>
      serviceMocks.detailExportRecordQueryOptions(...args),
    downloadExportRecordMutationOptions: () => serviceMocks.downloadExportRecordMutationOptions(),
    batchDownloadExportRecordsMutationOptions: () =>
      serviceMocks.batchDownloadExportRecordsMutationOptions(),
    deleteExportRecordMutationOptions: () => serviceMocks.deleteExportRecordMutationOptions()
  };
});

import ExportCenterManagementPage from './export-center-management-page';

type ExportRecordRow = {
  recordId?: number;
  exportBizCode?: string;
  exportBizName?: string;
  fileName?: string;
  fileType?: string;
  status?: number;
  statusName?: string;
  contentType?: string;
  fileSize?: number;
  downloadCount?: number;
  querySnapshotSummary?: string;
  finishedTime?: string;
  expireTime?: string;
  createTime?: string;
  createBy?: number;
};

type ExportRecordRequest = {
  pageNo: number;
  pageSize: number;
  condition?: {
    nodeType: 'compose' | 'text';
    logic?: 'AND' | 'OR';
    field?: string;
    op?: string;
    value?: string;
    children?: ExportRecordRequest['condition'][];
  };
  sort?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
};

const EXPORT_CENTER_ROWS: ExportRecordRow[] = [
  {
    recordId: 101,
    exportBizCode: 'framework.export',
    exportBizName: '导出记录导出',
    fileName: '导出记录-20260629.csv',
    fileType: 'csv',
    status: EXPORT_RECORD_STATUS.SUCCESS,
    statusName: 'SUCCESS',
    contentType: 'text/csv;charset=UTF-8',
    fileSize: 2048,
    downloadCount: 1,
    querySnapshotSummary: '客户=云禾',
    finishedTime: '2026-06-29 10:10:00',
    expireTime: '2026-07-06 10:10:00',
    createTime: '2026-06-29 10:00:00',
    createBy: 10001
  },
  {
    recordId: 102,
    exportBizCode: 'customer.summary',
    exportBizName: '客户汇总导出',
    fileName: '客户汇总-20260629.csv',
    fileType: 'csv',
    status: EXPORT_RECORD_STATUS.PROCESSING,
    statusName: 'PROCESSING',
    contentType: 'text/csv;charset=UTF-8',
    fileSize: 0,
    downloadCount: 0,
    querySnapshotSummary: '状态=处理中',
    createTime: '2026-06-29 11:00:00',
    createBy: 10002
  }
];

const PAGE_SIZE_STORAGE_KEY = 'app-data-table-per-page:export-center-list';

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    }
  } as Storage;
}

function matchesCondition(
  record: ExportRecordRow,
  condition?: ExportRecordRequest['condition']
): boolean {
  if (!condition) return true;

  if (condition.nodeType === 'compose') {
    const children = condition.children ?? [];
    return condition.logic === 'OR'
      ? children.some((child): boolean => matchesCondition(record, child))
      : children.every((child): boolean => matchesCondition(record, child));
  }

  const value = String(record[condition.field as keyof ExportRecordRow] ?? '');
  const keyword = condition.value ?? '';
  if (condition.op === 'EQ') return value === keyword;
  return value.includes(keyword);
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function getRowSelectHitbox(container: HTMLElement, rowIndex: number) {
  const hitboxes = container.querySelectorAll('[data-slot="data-table-select-hitbox"]');
  const rowHitbox = hitboxes.item(rowIndex + 1);

  if (!(rowHitbox instanceof HTMLElement)) {
    throw new Error(`row ${rowIndex + 1} select hitbox missing`);
  }

  return rowHitbox;
}

describe('ExportCenterManagementPage', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    serviceMocks.pageMyExportRecordsQueryOptions.mockReset();
    serviceMocks.detailExportRecordQueryOptions.mockReset();
    serviceMocks.downloadExportRecordMutationOptions.mockReset();
    serviceMocks.batchDownloadExportRecordsMutationOptions.mockReset();
    serviceMocks.deleteExportRecordMutationOptions.mockReset();
    downloadFileMocks.downloadFileFromUrl.mockReset();

    mutationMocks.downloadMutation.mutationFn = vi
      .fn()
      .mockResolvedValue({ downloadUrl: 'https://download.example.com/export.csv' });
    mutationMocks.downloadMutation.onSuccess = vi.fn().mockResolvedValue(undefined);
    mutationMocks.batchDownloadMutation.mutationFn = vi
      .fn()
      .mockResolvedValue({ downloadUrl: 'https://download.example.com/batch.zip' });
    mutationMocks.batchDownloadMutation.onSuccess = vi.fn().mockResolvedValue(undefined);
    mutationMocks.deleteMutation.mutationFn = vi.fn().mockResolvedValue(undefined);
    mutationMocks.deleteMutation.onSuccess = vi.fn().mockResolvedValue(undefined);

    const localStorageMock = createLocalStorageMock();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock
    });

    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '10');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    } as typeof ResizeObserver;

    serviceMocks.pageMyExportRecordsQueryOptions.mockImplementation(
      (request: ExportRecordRequest) =>
        queryOptions({
          queryKey: ['export-center-page', request],
          queryFn: async () => {
            const filtered = EXPORT_CENTER_ROWS.filter((record) =>
              matchesCondition(record, request.condition)
            );
            return {
              total: filtered.length,
              list: filtered.slice(
                ((request.pageNo ?? 1) - 1) * (request.pageSize ?? 10),
                (request.pageNo ?? 1) * (request.pageSize ?? 10)
              )
            };
          }
        })
    );

    serviceMocks.detailExportRecordQueryOptions.mockImplementation(
      (request: { recordId: number }) =>
        queryOptions({
          queryKey: ['export-center-detail', request],
          queryFn: async () =>
            EXPORT_CENTER_ROWS.find((record) => record.recordId === request.recordId) ?? null
        })
    );

    serviceMocks.downloadExportRecordMutationOptions.mockImplementation(
      () => mutationMocks.downloadMutation
    );
    serviceMocks.batchDownloadExportRecordsMutationOptions.mockImplementation(
      () => mutationMocks.batchDownloadMutation
    );
    serviceMocks.deleteExportRecordMutationOptions.mockImplementation(
      () => mutationMocks.deleteMutation
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    globalThis.ResizeObserver = originalResizeObserver;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage
    });
  });

  it('renders the table with correct total count', async () => {
    render(<ExportCenterManagementPage />, { wrapper: createWrapper() });

    await screen.findByText('导出记录-20260629.csv');

    expect(screen.getByText(/共\s*2\s*条数据/)).toBeInTheDocument();
  });

  it('shows empty state when no export records exist', async () => {
    serviceMocks.pageMyExportRecordsQueryOptions.mockImplementation(
      (request: ExportRecordRequest) =>
        queryOptions({
          queryKey: ['export-center-page-empty', request],
          queryFn: async () => ({ total: 0, list: [] })
        })
    );

    render(<ExportCenterManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('暂无导出记录')).toBeInTheDocument();
    });
  });

  it('filters by file name and sends the DSL condition', async () => {
    const requests: ExportRecordRequest[] = [];
    serviceMocks.pageMyExportRecordsQueryOptions.mockImplementation(
      (request: ExportRecordRequest) => {
        requests.push(request);

        return queryOptions({
          queryKey: ['export-center-page-filtered', request],
          queryFn: async () => {
            const filtered = EXPORT_CENTER_ROWS.filter((record) =>
              matchesCondition(record, request.condition)
            );
            return {
              total: filtered.length,
              list: filtered
            };
          }
        });
      }
    );

    const user = userEvent.setup();
    render(<ExportCenterManagementPage />, { wrapper: createWrapper() });

    await screen.findByText('导出记录-20260629.csv');
    await user.type(screen.getByPlaceholderText('搜索文件名'), '客户汇总');

    await waitFor(() => {
      expect(requests.at(-1)?.condition).toEqual({
        nodeType: 'compose',
        logic: 'AND',
        children: [
          {
            nodeType: 'text',
            field: 'fileName',
            op: 'CONTAINS',
            value: '客户汇总'
          }
        ]
      });
    });
    expect(screen.getByText('客户汇总-20260629.csv')).toBeInTheDocument();
  });

  it('downloads a row file through the shared download utility', async () => {
    const user = userEvent.setup();
    render(<ExportCenterManagementPage />, { wrapper: createWrapper() });

    const row = (await screen.findByText('导出记录-20260629.csv')).closest('tr');
    expect(row).toBeInTheDocument();

    await user.click(within(row!).getByRole('button', { name: '下载' }));

    await waitFor(() => {
      expect(mutationMocks.downloadMutation.mutationFn).toHaveBeenCalledWith(
        { recordId: 101 },
        expect.any(Object)
      );
    });
    expect(downloadFileMocks.downloadFileFromUrl).toHaveBeenCalledWith(
      'https://download.example.com/export.csv',
      '导出记录-20260629.csv'
    );
  });

  it('deletes selected rows through the batch delete API', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExportCenterManagementPage />, { wrapper: createWrapper() });

    await screen.findByText('导出记录-20260629.csv');
    expect(screen.queryByRole('button', { name: /批量删除/ })).not.toBeInTheDocument();

    await user.click(getRowSelectHitbox(container, 0));

    expect(screen.getByRole('button', { name: /批量删除/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /批量删除/ }));
    await user.click(await screen.findByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(mutationMocks.deleteMutation.mutationFn).toHaveBeenCalledWith(
        { ids: [101] },
        expect.any(Object)
      );
    });
  });
});
