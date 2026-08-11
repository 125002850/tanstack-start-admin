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
import { DataTable } from '@/components/data-table/core/data-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import {
  type DataTableDslPageRequestBase,
  type DataTableDslSortItem,
  useDslDataTable
} from '@/hooks/use-data-table';
import type { DataTableDateValue } from '@/types/data-table';

const MOCK_ROW_COUNT = 10_000;
const VIRTUAL_STRESS_PAGE_SIZE = 500;
const REMOTE_OPTION_COUNT = 120;
const REMOTE_OPTION_PAGE_SIZE = 20;
const REMOTE_OPTION_DELAY_MS = 1_000;
const REMOTE_RESOLVE_DELAY_MS = 30;
const MOCK_SORT_COLLATOR = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base'
});

type ContractRow = {
  id: number;
  name: string;
  phone: string;
  remark: string;
  score: number | null;
  quantity: number;
  weight: number | null;
  budget: number | null;
  completionRate: number | null;
  effectiveDate: DataTableDateValue | null;
  executeAt: string | null;
  localStartsAt: string;
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
  'longText · textarea',
  'number · numeric',
  'int · numeric',
  'decimal · numeric',
  'money · numeric',
  'percent · numeric',
  'date · calendar',
  'dateTime · instant',
  'dateTime · local',
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

const columnDsl = createDataTableColumnDsl<ContractRow>({
  tableId: 'data-table-editing-example',
  tableTimeZone: 'Asia/Shanghai'
});
const columns = [
  columnDsl.field('name', '名称', { size: 'sm' }),
  columnDsl.editableField('phone', '手机号', {
    type: 'text',
    size: 'md',
    edit: { control: 'input', inputType: 'tel', inputMode: 'tel' }
  }),
  columnDsl.editableField('remark', '备注', {
    type: 'longText',
    size: 'xl',
    edit: {
      control: 'textarea',
      allowEmpty: false,
      minLength: 2,
      maxLength: 120,
      rows: 5
    }
  }),
  columnDsl.editableField('score', '评分', {
    type: 'number',
    edit: {
      maxFractionDigits: 2
    }
  }),
  columnDsl.editableField('quantity', '数量', {
    type: 'int',
    edit: {
      allowEmpty: false,
      min: 0,
      max: 9999,
      step: 1,
      showStepperButtons: true
    }
  }),
  columnDsl.editableField('weight', '重量', {
    type: 'decimal',
    edit: {
      min: 0,
      step: 0.001,
      maxFractionDigits: 3
    }
  }),
  columnDsl.editableField('budget', '预算', {
    type: 'money',
    edit: {
      currency: 'CNY',
      min: 0,
      step: 0.01,
      maxFractionDigits: 2
    }
  }),
  columnDsl.editableField('completionRate', '完成率', {
    type: 'percent',
    edit: {
      min: 0,
      max: 1,
      step: 0.0001,
      maxFractionDigits: 2
    }
  }),
  columnDsl.editableField('effectiveDate', '生效日期', {
    type: 'date',
    edit: {
      min: '2026-01-01',
      max: '2026-12-31',
      isDateUnavailable: (value) => value === '2026-07-31'
    }
  }),
  columnDsl.editableField('executeAt', '执行时间', {
    type: 'dateTime',
    edit: {
      valueKind: 'instant',
      granularity: 'minute',
      step: 5,
      defaultTime: '09:30'
    }
  }),
  columnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: {
      valueKind: 'local',
      granularity: 'second',
      step: 15,
      allowEmpty: false
    }
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
    remark: `记录 ${String(index + 1).padStart(3, '0')} 的第一行备注\n第二行备注`,
    score: 80 + (index % 10) + 0.5,
    quantity: index + 1,
    weight: 10 + (index % 10) * 0.125,
    budget: 1000 + index * 10.5,
    completionRate: ((index % 9) + 1) / 10,
    effectiveDate: `2026-07-${String((index % 28) + 1).padStart(2, '0')}` as DataTableDateValue,
    executeAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T04:05:00.000Z`,
    localStartsAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T12:00:15`,
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

function compareMockValues(left: unknown, right: unknown) {
  if (Object.is(left, right)) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return MOCK_SORT_COLLATOR.compare(String(left), String(right));
}

/** 模拟服务端排序，确保 useDslDataTable 示例真实消费表头生成的 DSL sort。 */
function sortMockRows(rows: ContractRow[], sort: DataTableDslSortItem[] | undefined) {
  if (!sort?.length) return rows;

  return rows.toSorted((left, right) => {
    for (const item of sort) {
      const compared = compareMockValues(
        left[item.field as keyof ContractRow],
        right[item.field as keyof ContractRow]
      );
      if (compared !== 0) {
        return item.direction === 'DESC' ? -compared : compared;
      }
    }

    return 0;
  });
}

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
          const sortedRows = sortMockRows(serverRowsRef.current, request.sort);
          const start = (request.pageNo - 1) * request.pageSize;
          return {
            list: sortedRows.slice(start, start + request.pageSize),
            total: serverRowsRef.current.length
          };
        }
      }),
    [tableId]
  );
  const { table, editing, queryState, refreshProps } = useDslDataTable({
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
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              editing.setServerCellErrors({
                revision: editing.getRevision(),
                errors: [
                  {
                    rowId: '1',
                    field: 'phone',
                    messages: ['手机号已被服务端占用'],
                    code: 'PHONE_TAKEN'
                  }
                ]
              });
            }}
          >
            模拟服务端校验失败
          </Button>
          <Button type='button' variant='outline' onClick={() => editing.clearServerCellErrors()}>
            清除服务端错误
          </Button>
          <Badge variant='secondary'>
            最近提交：
            <span data-testid='editable-choice-last-reason'>{lastReason}</span>
          </Badge>
          <Badge variant='secondary'>
            服务端错误：
            <span data-testid='editable-choice-server-error-count'>
              {editing.getServerCellErrors().length}
            </span>
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
          virtualization={{
            mode: 'on',
            estimateRowHeight: 44,
            overscan: 8
          }}
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
