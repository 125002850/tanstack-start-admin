import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  page: vi.fn(),
  detail: vi.fn()
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
  }) =>
    React.createElement(
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
            if (typeof viewportRef === 'function') viewportRef(node);
            else if (viewportRef && 'current' in viewportRef) viewportRef.current = node;
          },
          'data-scroll-target-id': viewportProps?.['data-scroll-target-id'],
          'data-testid': 'scroll-viewport'
        },
        children
      )
    )
}));

vi.mock('@/lib/api/clients/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/clients/service')>()),
  systemDictGlobalItemsOptions: async () => [
    {
      dictTypeCode: 'OPERATION_AUDIT_ACTION',
      items: [
        { code: 'create', name: '新增', status: 'enable' },
        { code: 'update', name: '修改', status: 'enable' }
      ]
    },
    {
      dictTypeCode: 'OPERATION_AUDIT_STATUS',
      items: [
        { code: 'success', name: '成功', status: 'enable' },
        { code: 'failed', name: '失败', status: 'enable' }
      ]
    }
  ],
  pageOperationAuditLogsQueryKey: (request: unknown) => ['service', 'operation-audit', request],
  pageOperationAuditLogsQueryOptions: (...args: unknown[]) => serviceMocks.page(...args),
  detailOperationAuditLogQueryOptions: (...args: unknown[]) => serviceMocks.detail(...args)
}));

import OperationAuditManagementPage from './operation-audit-management-page';

interface AuditRequest {
  pageNo: number;
  pageSize: number;
  condition?: {
    nodeType: 'compose' | 'text';
    logic?: 'AND' | 'OR';
    field?: string;
    op?: string;
    value?: string;
    children?: AuditRequest['condition'][];
  };
}

const rows = [
  {
    logId: 18,
    moduleCode: 'system.code-rule',
    moduleName: '编码规则',
    action: 'create',
    description: '新增编码规则',
    operatorId: 1001,
    operatorName: '审计管理员',
    clientIp: '120.229.36.171',
    resultStatus: 'success',
    durationMs: 5,
    operationTime: '2026-09-02 11:00:00'
  },
  {
    logId: 17,
    moduleCode: 'mdm.partner',
    moduleName: '业务伙伴',
    action: 'update',
    description: '保存并提交审核',
    operatorId: 1002,
    operatorName: '业务管理员',
    clientIp: '14.134.5.77',
    resultStatus: 'failed',
    durationMs: 13,
    operationTime: '2026-09-02 10:00:00'
  }
];

function matches(row: (typeof rows)[number], condition?: AuditRequest['condition']): boolean {
  if (!condition) return true;
  if (condition.nodeType === 'compose') {
    const children = condition.children ?? [];
    return condition.logic === 'OR'
      ? children.some((child) => matches(row, child))
      : children.every((child) => matches(row, child));
  }
  return String(row[condition.field as keyof typeof row] ?? '').includes(condition.value ?? '');
}

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value)
  } as Storage;
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('OperationAuditManagementPage', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    serviceMocks.page.mockReset();
    serviceMocks.detail.mockReset();
    const storage = createStorage();
    storage.setItem('app-data-table-per-page:operation-audit-log-list', '10');
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    } as typeof ResizeObserver;

    serviceMocks.page.mockImplementation((request: AuditRequest) =>
      queryOptions({
        queryKey: ['operation-audit-page-test', request],
        queryFn: async () => {
          const filtered = rows.filter((row) => matches(row, request.condition));
          return { total: filtered.length, list: filtered };
        }
      })
    );
    serviceMocks.detail.mockImplementation((request: { logId: number }) =>
      queryOptions({
        queryKey: ['operation-audit-detail-test', request],
        queryFn: async () => ({
          ...rows.find((row) => row.logId === request.logId),
          operatorUsername: 'business-admin',
          operatorRealName: '业务管理员',
          requestMethod: 'POST',
          requestPath: '/api/mdm/partner/save-and-submit',
          traceId: 'trace-failed-17',
          requestParams: '{"name":"合作伙伴","token":"******"}',
          httpStatus: 200,
          resultCode: 3004001,
          errorMessage: '该公司主体已关联业务伙伴'
        })
      })
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

  it('renders total, dictionary labels and result badges', async () => {
    render(<OperationAuditManagementPage />, { wrapper: createWrapper() });

    await screen.findByText('编码规则');
    expect(screen.getByText('新增')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
  });

  it('sends the module quick filter through the dynamic DSL', async () => {
    const user = userEvent.setup();
    render(<OperationAuditManagementPage />, { wrapper: createWrapper() });
    await screen.findByText('编码规则');

    await user.type(screen.getByPlaceholderText('搜索模块'), '业务伙伴');

    await waitFor(() => {
      expect(serviceMocks.page.mock.calls.at(-1)?.[0].condition).toEqual({
        nodeType: 'compose',
        logic: 'AND',
        children: [
          {
            nodeType: 'text',
            field: 'moduleName',
            op: 'CONTAINS',
            value: '业务伙伴'
          }
        ]
      });
    });
    expect(screen.getByText('保存并提交审核')).toBeInTheDocument();
  });

  it('loads failure detail with trace id, formatted masked params and destructive error', async () => {
    const user = userEvent.setup();
    render(<OperationAuditManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('保存并提交审核')).toBeInTheDocument());
    const row = screen.getByText('保存并提交审核').closest('tr');
    expect(row).toBeInTheDocument();
    await user.click(within(row!).getByRole('button', { name: '详情' }));

    expect(await screen.findByText('操作日志详情')).toBeInTheDocument();
    expect(await screen.findByText('trace-failed-17')).toBeInTheDocument();
    expect(screen.getByText('该公司主体已关联业务伙伴')).toBeInTheDocument();
    expect(screen.getByText(/"token": "\*\*\*\*\*\*"/)).toBeInTheDocument();
    expect(serviceMocks.detail).toHaveBeenCalledWith({ logId: 17 });
  });

  it('shows the unfiltered empty state', async () => {
    serviceMocks.page.mockImplementation((request: AuditRequest) =>
      queryOptions({
        queryKey: ['operation-audit-empty-test', request],
        queryFn: async () => ({ total: 0, list: [] })
      })
    );
    render(<OperationAuditManagementPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('暂无操作日志')).toBeInTheDocument();
  });
});
