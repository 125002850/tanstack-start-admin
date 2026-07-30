import { queryOptions } from '@tanstack/react-query';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { DataTable } from '@/components/ui/table/core/data-table';
import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslPageRequestBase } from '@/hooks/use-dsl-data-table.dsl';

const MOCK_ROW_COUNT = 10_000;
const VIRTUAL_STRESS_PAGE_SIZE = 500;
const REMOTE_OPTION_COUNT = 120;
const REMOTE_OPTION_PAGE_SIZE = 20;
const REMOTE_OPTION_DELAY_MS = 1_000;
const REMOTE_RESOLVE_DELAY_MS = 30;

type ContractRow = {
  id: number;
  name: string;
  phone: string;
  availability: 'ENABLED' | 'DISABLED';
  status: 'DRAFT' | 'READY' | null;
  labels: Array<'CORE' | 'URGENT' | 'EXTERNAL'>;
  departmentId: number | null;
  roleIds: number[];
  ownerId: number | null;
  reviewerIds: number[];
};

const LABEL_VALUES = ['CORE', 'URGENT', 'EXTERNAL'] as const;
const LABEL_OPTIONS = [
  { value: 'CORE', label: '核心' },
  { value: 'URGENT', label: '紧急' },
  { value: 'EXTERNAL', label: '外部' }
] as const;
const DEPARTMENT_OPTIONS = [
  { value: 201, label: '研发部' },
  { value: 202, label: '产品部' },
  { value: 203, label: '运营部' }
] as const;
const ROLE_OPTIONS = [
  { value: 1, label: '管理员' },
  { value: 2, label: '审计员' },
  { value: 3, label: '访客' }
] as const;
const PERSON_OPTION_SEEDS = [
  { value: 101, label: '张三' },
  { value: 102, label: '李四' },
  { value: 103, label: '王五' },
  { value: 104, label: '赵六' },
  { value: 105, label: '钱七' }
] as const;
const PERSON_OPTIONS = [
  ...PERSON_OPTION_SEEDS,
  ...Array.from({ length: REMOTE_OPTION_COUNT - PERSON_OPTION_SEEDS.length }, (_, index) => {
    const ordinal = index + PERSON_OPTION_SEEDS.length + 1;
    return {
      value: 100 + ordinal,
      label: `远程人员 ${String(ordinal).padStart(3, '0')}`
    };
  })
];
const EDITOR_COVERAGE = [
  'text · input',
  'enum · single',
  'enum · multiple',
  'select · single',
  'select · multiple',
  'remoteSelect · single',
  'remoteSelect · multiple',
  'enum · switch'
] as const;

function waitForFixture(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

function createRemoteOptions() {
  return {
    async loadOptions({
      keyword,
      pageNo,
      pageSize,
      signal
    }: {
      keyword: string;
      pageNo: number;
      pageSize: number;
      signal: AbortSignal;
    }) {
      await waitForFixture(REMOTE_OPTION_DELAY_MS, signal);
      const normalizedKeyword = keyword.trim().toLowerCase();
      const filtered = normalizedKeyword
        ? PERSON_OPTIONS.filter(
            (option) =>
              option.label.toLowerCase().includes(normalizedKeyword) ||
              String(option.value).includes(normalizedKeyword)
          )
        : PERSON_OPTIONS;
      const start = (pageNo - 1) * pageSize;
      return {
        items: filtered.slice(start, start + pageSize),
        total: filtered.length
      };
    },
    async resolveOptions({ values, signal }: { values: readonly number[]; signal: AbortSignal }) {
      await waitForFixture(REMOTE_RESOLVE_DELAY_MS, signal);
      return PERSON_OPTIONS.filter((option) => values.includes(option.value));
    },
    debounceMs: 30,
    pageSize: REMOTE_OPTION_PAGE_SIZE
  };
}

const columnDsl = createDataTableColumnDsl<ContractRow>();
const columns = [
  columnDsl.field('name', '名称', { size: 'sm' }),
  columnDsl.editableField('phone', '手机号', {
    type: 'text',
    size: 'md',
    edit: { control: 'input', inputType: 'tel', inputMode: 'tel' }
  }),
  columnDsl.editableField('availability', '启用状态', {
    type: 'enum',
    valueOptions: [
      { value: 'ENABLED', label: '启用' },
      { value: 'DISABLED', label: '停用' }
    ],
    edit: {
      control: 'switch',
      checkedValue: 'ENABLED',
      uncheckedValue: 'DISABLED'
    }
  }),
  columnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [
      { value: 'DRAFT', label: '草稿' },
      { value: 'READY', label: '就绪' }
    ],
    edit: { selectionMode: 'single' }
  }),
  columnDsl.editableField('labels', '标签', {
    type: 'enum',
    valueOptions: LABEL_OPTIONS,
    edit: { selectionMode: 'multiple', maxSelected: 2 }
  }),
  columnDsl.editableField('departmentId', '部门', {
    type: 'select',
    valueOptions: DEPARTMENT_OPTIONS,
    edit: { selectionMode: 'single', allowEmpty: false }
  }),
  columnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: ROLE_OPTIONS,
    edit: { selectionMode: 'multiple', maxSelected: 2 }
  }),
  columnDsl.editableField('ownerId', '负责人', {
    type: 'remoteSelect',
    remoteOptions: createRemoteOptions(),
    edit: { selectionMode: 'single' }
  }),
  columnDsl.editableField('reviewerIds', '协作人', {
    type: 'remoteSelect',
    remoteOptions: createRemoteOptions(),
    edit: { selectionMode: 'multiple', maxSelected: 3 }
  })
];

function createRows(): ContractRow[] {
  return Array.from({ length: MOCK_ROW_COUNT }, (_, index) => ({
    id: index + 1,
    name: `记录 ${String(index + 1).padStart(3, '0')}`,
    phone: `138${String(index + 1).padStart(8, '0')}`,
    availability: index % 2 === 0 ? 'ENABLED' : 'DISABLED',
    status: (index + 1) % 7 === 0 ? null : index % 2 === 0 ? 'DRAFT' : 'READY',
    labels: [LABEL_VALUES[index % LABEL_VALUES.length]!],
    departmentId: DEPARTMENT_OPTIONS[index % DEPARTMENT_OPTIONS.length]!.value,
    roleIds: index === 1 ? [999] : [1],
    ownerId: PERSON_OPTION_SEEDS[index % PERSON_OPTION_SEEDS.length]!.value,
    reviewerIds: [PERSON_OPTION_SEEDS[(index + 1) % PERSON_OPTION_SEEDS.length]!.value]
  }));
}

const MOCK_ROWS = createRows();

interface DataTableEditingExampleProps {
  tableId?: string;
  testId?: string;
  preferredPageSize?: number;
}

export function DataTableEditableChoiceContractPage({
  tableId = 'data-table-editable-choice-contract',
  testId = 'data-table-editable-choice-contract',
  preferredPageSize
}: DataTableEditingExampleProps = {}) {
  const serverRowsRef = React.useRef<ContractRow[]>(MOCK_ROWS);
  const appliedPreferredPageSizeRef = React.useRef(false);
  const [lastReason, setLastReason] = React.useState('-');
  const [snapshotText, setSnapshotText] = React.useState('{}');
  const queryOptionsFactory = React.useCallback(
    (request: DataTableDslPageRequestBase) =>
      queryOptions({
        queryKey: [tableId, request],
        queryFn: async () => {
          const start = (request.pageNo - 1) * request.pageSize;
          return {
            list: serverRowsRef.current.slice(start, start + request.pageSize),
            total: serverRowsRef.current.length
          };
        }
      }),
    [tableId]
  );
  const { table, editing, queryState, refreshProps, total } = useDslDataTable({
    tableId,
    columns,
    queryOptions: queryOptionsFactory,
    rowId: 'id',
    showSelectColumn: false,
    showRowNumberColumn: false,
    editing: {
      onChange: ({ reason }) => setLastReason(reason)
    }
  });

  React.useEffect(() => {
    if (
      appliedPreferredPageSizeRef.current ||
      preferredPageSize === undefined ||
      table.getState().pagination.pageSize === preferredPageSize
    ) {
      return;
    }

    appliedPreferredPageSizeRef.current = true;
    table.setPageSize(preferredPageSize);
  }, [preferredPageSize, table]);

  const readSnapshot = React.useCallback(() => {
    setSnapshotText(JSON.stringify(editing.getSnapshot()));
  }, [editing]);

  const refetchWithServerUpdate = React.useCallback(async () => {
    serverRowsRef.current = serverRowsRef.current.map((row) =>
      row.id === 1 ? { ...row, name: '记录 001（服务端刷新）' } : row
    );
    await queryState.refetch();
  }, [queryState]);

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>DataTable 表格编辑示例</CardTitle>
        <CardDescription>
          使用 {MOCK_ROW_COUNT.toLocaleString('zh-CN')} 条 mock 数据覆盖全部 editor
          组合；双击单元格或按 Enter / F2 开始编辑。
        </CardDescription>
        <CardAction className='flex flex-wrap justify-end gap-2'>
          <Badge variant='secondary'>{EDITOR_COVERAGE.length} 种编辑组合</Badge>
          <Badge variant='outline'>行虚拟化</Badge>
          <Badge variant='outline'>
            远程选项 {REMOTE_OPTION_COUNT} 条 / 每页 {REMOTE_OPTION_PAGE_SIZE} 条
          </Badge>
          <Badge variant='outline'>加载延迟约 1 秒</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className='flex min-h-[680px] flex-col gap-3'>
        <div data-testid='data-table-editor-coverage' className='flex flex-wrap items-center gap-2'>
          {EDITOR_COVERAGE.map((editor) => (
            <Badge key={editor} variant='outline'>
              {editor}
            </Badge>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button type='button' variant='outline' onClick={readSnapshot}>
            读取草稿
          </Button>
          <Button type='button' variant='outline' onClick={refetchWithServerUpdate}>
            模拟服务端刷新
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              const snapshot = editing.getSnapshot();
              editing.acceptChanges(snapshot.changes);
              readSnapshot();
            }}
          >
            确认草稿
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              editing.discardChanges();
              readSnapshot();
            }}
          >
            放弃草稿
          </Button>
          <Badge variant='secondary'>
            最近提交：
            <span data-testid='editable-choice-last-reason'>{lastReason}</span>
          </Badge>
        </div>
        <pre
          data-testid='editable-choice-snapshot'
          className='max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs'
        >
          {snapshotText}
        </pre>
        <DataTable
          table={table}
          statusTotalCount={total}
          virtualization={{ mode: 'on', estimateRowHeight: 44, overscan: 4 }}
          onRefresh={refreshProps?.onRefresh}
          isRefreshing={refreshProps?.isRefreshing}
        />
      </CardContent>
    </Card>
  );
}

export function DataTableEditingExamplePage() {
  return (
    <DataTableEditableChoiceContractPage
      tableId='data-table-editing-example'
      testId='data-table-editing-example'
      preferredPageSize={VIRTUAL_STRESS_PAGE_SIZE}
    />
  );
}
