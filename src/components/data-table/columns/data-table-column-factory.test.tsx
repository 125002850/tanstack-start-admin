import * as React from 'react';
import type { Row as TanStackRow } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import type { DataTableRowAction } from '@/types/data-table';

import {
  createDataTableColumnDsl,
  dataTableColumnFormatters,
  percentPoints
} from './data-table-column-factory';

interface Row {
  id?: number;
  name?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  active?: boolean;
  kind?: string;
  phone?: string;
}

interface ChoiceRow {
  id: number;
  status: 'ENABLED' | 'DISABLED' | null;
  roleIds: number[];
  name: string;
  strictRemark: string;
  remark: string | null;
  amount: number;
  nullableAmount: number | null;
  optionalAmount?: number;
  strictDate: string;
  effectiveDate: string | null;
  optionalDate?: string;
  executeAt: string | null;
  localStartsAt: string;
}

interface AuditRow {
  id: number;
  createById?: number | null;
  createByName?: string | null;
  createTime?: string | null;
  updateById?: number | null;
  updateByName?: string | null;
  updateTime?: string | null;
}

function renderCell(column: { cell?: unknown }, row: Row) {
  if (typeof column.cell !== 'function') return undefined;
  const accessorKey = (column as { accessorKey?: keyof Row }).accessorKey;
  return column.cell({
    row: { original: row },
    getValue: () => (accessorKey ? row[accessorKey] : undefined)
  });
}

function renderCellWithTableRow(column: { cell?: unknown }, tableRow: TanStackRow<Row>) {
  if (typeof column.cell !== 'function') return undefined;

  return column.cell({ row: tableRow });
}

function getRenderedRowActions(node: unknown) {
  expect(React.isValidElement(node)).toBe(true);

  return (node as React.ReactElement<{ actions: Array<DataTableRowAction<Row>> }>).props.actions;
}

function getNodeText(node: unknown): string | undefined {
  if (node == null) return undefined;

  const nodeType = typeof node;
  if (
    nodeType === 'string' ||
    nodeType === 'number' ||
    nodeType === 'bigint' ||
    nodeType === 'boolean'
  ) {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return undefined;
}

function renderCellText(column: { cell?: unknown }, row: Row) {
  return getNodeText(renderCell(column, row));
}

describe('data-table-column-factory', () => {
  it('creates field columns with normalized empty values', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('name', '名称');

    expect((column as { accessorKey?: unknown }).accessorKey).toBe('name');
    expect(column.enableSorting).toBe(true);
    expect(column.meta?.label).toBe('名称');
    expect(column.meta?.localFilter).toMatchObject({ variant: 'text' });
    expect(renderCellText(column, { name: '' })).toBe('-');
    expect(renderCellText(column, { name: '云禾' })).toBe('云禾');
  });

  it('creates formatted money columns', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('amount', '金额', { type: 'money' });

    expect(renderCellText(column, { amount: 1234.5 })).toBe('1,234.50');
    expect(column.meta?.copyValue?.(1234.5, { amount: 1234.5 })).toBe('1234.5');
  });

  it('formats field columns through the format option', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('status', '状态', {
      format: (value) => (value === 'DONE' ? '已完成' : value)
    });

    expect(renderCellText(column, { status: 'DONE' })).toBe('已完成');
  });

  it('creates badge columns without rendering empty badges', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const emptyColumn = columnDsl.badge('status', '状态');
    const badgeColumn = columnDsl.badge('status', '状态');

    expect(badgeColumn.meta?.label).toBe('状态');
    expect(renderCell(emptyColumn, {})).toBe('-');
    expect(renderCell(badgeColumn, { status: '成功' })).toBeTruthy();
  });

  it('creates a page scoped column dsl with field formatters', () => {
    const columnDsl = createDataTableColumnDsl<Row>({
      fieldFormatters: [
        dataTableColumnFormatters.money<Row>(['amount']),
        dataTableColumnFormatters.date<Row>(['createdAt'])
      ]
    });

    expect(renderCellText(columnDsl.field('amount', '金额'), { amount: 12 })).toBe('12.00');
    expect(
      renderCellText(columnDsl.field('createdAt', '创建时间'), {
        createdAt: '2026-06-29'
      })
    ).toBe('2026-06-29');
    expect(
      renderCellText(
        columnDsl.field('status', '状态', {
          format: (value) => (value === 'DONE' ? '已完成' : value)
        }),
        { status: 'DONE' }
      )
    ).toBe('已完成');
  });

  it('compiles field filter options and dsl query metadata', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('name', '名称', {
      filter: 'text',
      filterPlaceholder: '搜索名称',
      enableSorting: true,
      dsl: {
        filterField: 'customer_name',
        sortField: 'customer_name_sort',
        filterOperator: 'EQ'
      }
    });

    expect((column as { accessorKey?: unknown }).accessorKey).toBe('name');
    expect(column.enableColumnFilter).toBe(true);
    expect(column.enableSorting).toBe(true);
    expect(column.sortDescFirst).toBe(false);
    expect(column.meta).toMatchObject({
      label: '名称',
      variant: 'text',
      placeholder: '搜索名称',
      columnPanelVisible: true,
      columnPanelReorder: true,
      query: {
        filterField: 'customer_name',
        sortField: 'customer_name_sort',
        operator: 'EQ'
      }
    });
  });

  it('enables sorting for business columns by default and preserves explicit opt-out', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const customOptions = {
      id: 'summary',
      title: '摘要',
      accessorFn: (row: Row) => row.name,
      cell: ({ getValue }: { getValue: () => unknown }) => String(getValue() ?? '')
    };

    expect(columnDsl.field('name', '名称').enableSorting).toBe(true);
    expect(columnDsl.badge('status', '状态').enableSorting).toBe(true);
    expect(columnDsl.custom(customOptions).enableSorting).toBe(true);

    expect(columnDsl.field('name', '名称', { enableSorting: false }).enableSorting).toBe(false);
    expect(columnDsl.badge('status', '状态', { enableSorting: false }).enableSorting).toBe(false);
    expect(columnDsl.custom({ ...customOptions, enableSorting: false }).enableSorting).toBe(false);
  });

  it('compiles filter false without leaking stale filter meta', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('name', '名称', {
      filter: false,
      meta: {
        variant: 'text',
        placeholder: '旧占位',
        label: '旧名称'
      }
    });

    expect(column.enableColumnFilter).toBe(false);
    expect(column.meta?.label).toBe('旧名称');
    expect(column.meta?.variant).toBeUndefined();
    expect(column.meta?.placeholder).toBeUndefined();
    expect(column.meta?.localFilter).toMatchObject({ variant: 'text' });
  });

  it('infers current-page filters independently from server search filters', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const moneyColumn = columnDsl.field('amount', '金额', { type: 'money' });
    const serverFilteredColumn = columnDsl.field('name', '名称', { filter: 'text' });

    expect(moneyColumn.meta?.localFilter).toMatchObject({
      variant: 'number'
    });
    expect(moneyColumn.meta?.localFilter?.formatValue?.(1234.5, { amount: 1234.5 })).toBe(
      '1,234.50'
    );
    expect(serverFilteredColumn.meta).not.toHaveProperty('formatValue');
    expect(
      columnDsl.field('createdAt', '创建时间', { type: 'dateTime' }).meta?.localFilter
    ).toMatchObject({ variant: 'date' });
    expect(columnDsl.field('active', '启用', { type: 'boolean' }).meta?.localFilter).toMatchObject({
      variant: 'boolean'
    });
    expect(
      columnDsl.field('kind', '类型', {
        type: 'enum',
        filterOptions: [{ label: '正式', value: 'A' }]
      }).meta?.localFilter
    ).toMatchObject({
      variant: 'select',
      options: [{ label: '正式', value: 'A' }]
    });
    expect(
      columnDsl.field('name', '名称', { localFilter: false }).meta?.localFilter
    ).toBeUndefined();
    expect(
      columnDsl.field('amount', '金额', {
        localFilter: 'numberRange',
        localFilterMin: 0,
        localFilterMax: 100,
        localFilterUnit: '元'
      }).meta?.localFilter
    ).toMatchObject({ variant: 'range', range: [0, 100], unit: '元' });
  });

  it('infers default filter placeholders', () => {
    const columnDsl = createDataTableColumnDsl<Row>();

    expect(columnDsl.field('name', '名称', { filter: 'text' }).meta?.placeholder).toBe('搜索名称');
    expect(columnDsl.field('status', '状态', { filter: 'select' }).meta?.placeholder).toBe(
      '选择状态'
    );
    expect(columnDsl.field('status', '状态', { filter: 'multiSelect' }).meta?.placeholder).toBe(
      '选择状态'
    );
    expect(columnDsl.field('createdAt', '创建时间', { filter: 'date' }).meta?.placeholder).toBe(
      '选择创建时间'
    );
    expect(
      columnDsl.field('createdAt', '创建时间', { filter: 'dateRange' }).meta?.placeholder
    ).toBe('选择创建时间范围');
    expect(columnDsl.field('amount', '金额', { filter: 'number' }).meta?.placeholder).toBe(
      '输入金额'
    );

    const numberRangeColumn = columnDsl.field('amount', '金额', {
      filter: 'numberRange',
      filterMin: 0,
      filterMax: 100,
      filterUnit: '元'
    });

    expect(numberRangeColumn.meta?.placeholder).toBe('输入金额范围');
    expect(numberRangeColumn.meta?.variant).toBe('range');
    expect(numberRangeColumn.meta?.range).toEqual([0, 100]);
    expect(numberRangeColumn.meta?.unit).toBe('元');
    expect(columnDsl.field('active', '启用', { filter: 'boolean' }).meta?.placeholder).toBe(
      '选择启用'
    );
  });

  it('applies field type defaults and fallback formatting', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const moneyColumn = columnDsl.field('amount', '金额', { type: 'money' });
    const booleanColumn = columnDsl.field('active', '启用', {
      type: 'boolean'
    });
    const enumColumn = columnDsl.field('kind', '类型', {
      type: 'enum',
      filterOptions: [{ label: '正式', value: 'A' }]
    });

    expect(moneyColumn.size).toBe(140);
    expect(moneyColumn.minSize).toBe(110);
    expect(renderCellText(moneyColumn, { amount: 1234.5 })).toBe('1,234.50');
    expect(renderCellText(booleanColumn, { active: true })).toBe('是');
    expect(renderCellText(booleanColumn, { active: false })).toBe('否');
    expect(renderCellText(enumColumn, { kind: 'A' })).toBe('正式');
  });

  it('creates badge, actions, custom, and custom type columns', () => {
    const onClick = vi.fn();
    const columnDsl = createDataTableColumnDsl<Row>({
      customTypes: {
        phone: {
          size: 140,
          minSize: 120,
          formatValue: (value) => `tel:${String(value)}`
        }
      }
    });
    const badgeColumn = columnDsl.badge('status', '状态');
    const actionsColumn = columnDsl.actions({
      actions: [{ id: 'view', label: '查看', onClick }]
    });
    const customColumn = columnDsl.custom({
      id: 'score',
      title: '评分',
      accessorFn: (row) => row.amount ?? 0,
      cell: ({ getValue }) => String(getValue())
    });
    const phoneColumn = columnDsl.field('phone', '电话', { type: 'phone' });

    expect(badgeColumn.size).toBe(120);
    expect(badgeColumn.minSize).toBe(96);
    expect(badgeColumn.meta?.label).toBe('状态');
    expect(renderCell(badgeColumn, { status: '成功' })).toBeTruthy();

    expect(actionsColumn.id).toBe('actions');
    expect((actionsColumn as { accessorKey?: unknown }).accessorKey).toBeUndefined();
    expect(actionsColumn.enableHiding).toBe(false);
    expect(actionsColumn.enableResizing).toBe(false);
    expect(actionsColumn.enableSorting).toBe(false);
    expect(actionsColumn.enableColumnFilter).toBe(false);
    expect(actionsColumn.size).toBe(96);
    expect(actionsColumn.minSize).toBe(72);
    expect(actionsColumn.maxSize).toBe(160);
    expect(actionsColumn.meta).toMatchObject({
      columnPanelVisible: false,
      columnPanelReorder: false
    });

    expect(customColumn.size).toBe(160);
    expect(customColumn.minSize).toBe(80);
    expect(customColumn.meta).toMatchObject({
      label: '评分',
      columnPanelVisible: true,
      columnPanelReorder: true
    });
    expect(phoneColumn.size).toBe(140);
    expect(phoneColumn.minSize).toBe(120);
    expect(renderCellText(phoneColumn, { phone: '13800138000' })).toBe('tel:13800138000');
  });

  it('resolves semantic size presets before creating native columns', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const columns = [
      columnDsl.field('name', '名称', { size: 'md' }),
      columnDsl.badge('status', '状态', { size: 'sm' }),
      columnDsl.actions({ size: 'xs', actions: [] }),
      columnDsl.custom({
        id: 'score',
        title: '评分',
        size: 'xl',
        cell: () => null
      }),
      columnDsl.field('amount', '金额', { size: 137 })
    ];

    expect(columns.map((column) => column.size)).toEqual([150, 110, 90, 220, 137]);
  });

  it('shares the same row action objects without adapting callbacks', () => {
    const onClick = vi.fn();
    const confirmDelete: NonNullable<DataTableRowAction<Row>['confirmDelete']> = {
      title: '确认删除',
      description: (row) => `确认删除 ${row.name ?? ''}`
    };
    const actions: Array<DataTableRowAction<Row>> = [
      { id: 'view', label: '查看', onClick, confirmDelete }
    ];
    const columnDsl = createDataTableColumnDsl<Row>();
    const actionsColumn = columnDsl.actions({ actions });
    const tableRow = { original: { id: 1, name: '云禾' } } as TanStackRow<Row>;

    const firstActions = getRenderedRowActions(renderCellWithTableRow(actionsColumn, tableRow));
    const secondActions = getRenderedRowActions(renderCellWithTableRow(actionsColumn, tableRow));

    expect(firstActions).toBe(actions);
    expect(secondActions).toBe(actions);
    expect(firstActions[0]?.confirmDelete).toBe(confirmDelete);

    firstActions[0]?.onClick?.(tableRow.original);
    expect(onClick).toHaveBeenCalledWith(tableRow.original);
  });

  it('rejects custom column types that override built-in types', () => {
    expect(() =>
      createDataTableColumnDsl<Row>({
        customTypes: {
          text: {}
        }
      })
    ).toThrow('cannot override a built-in type');
  });

  it('creates editable choice columns with static filter defaults and remote metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const statusColumn = columnDsl.editableField('status', '状态', {
      type: 'enum',
      valueOptions: [
        { value: 'ENABLED', label: '启用' },
        { value: 'DISABLED', label: '停用' }
      ],
      edit: { selectionMode: 'single', allowEmpty: false },
      filter: 'select'
    });
    const loadOptions = vi.fn();
    const roleColumn = columnDsl.editableField('roleIds', '角色', {
      type: 'remoteSelect',
      remoteOptions: {
        loadOptions
      },
      edit: { selectionMode: 'multiple', maxSelected: 3 }
    });

    expect((statusColumn as { accessorKey?: unknown }).accessorKey).toBe('status');
    expect(statusColumn.meta?.options).toEqual([
      { value: 'ENABLED', label: '启用' },
      { value: 'DISABLED', label: '停用' }
    ]);
    expect(statusColumn.meta?.localFilter).toMatchObject({
      variant: 'select',
      options: [
        { value: 'ENABLED', label: '启用' },
        { value: 'DISABLED', label: '停用' }
      ]
    });
    expect(statusColumn.meta?.editableChoice).toMatchObject({
      field: 'status',
      type: 'enum',
      selectionMode: 'single',
      allowEmpty: false
    });
    expect(statusColumn.meta?.editableCell).toBe(statusColumn.meta?.editableChoice);
    expect(roleColumn.meta?.editableChoice).toMatchObject({
      field: 'roleIds',
      type: 'remoteSelect',
      selectionMode: 'multiple',
      allowEmpty: true,
      maxSelected: 3
    });
    expect(roleColumn.meta?.editableChoice?.remoteOptions?.loadOptions).toBe(loadOptions);
    expect(roleColumn.meta?.localFilter).toMatchObject({ variant: 'text' });
  });

  it('creates input and switch editors as first-class editable cells', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const defaultInputColumn = columnDsl.editableField('name', '名称', {
      type: 'text'
    });
    const inputColumn = columnDsl.editableField('name', '手机号', {
      type: 'text',
      edit: { control: 'input', inputType: 'tel', inputMode: 'tel' }
    });
    const switchColumn = columnDsl.editableField('status', '状态', {
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
    });

    expect(defaultInputColumn.meta?.editableCell).toMatchObject({
      field: 'name',
      editor: 'input',
      allowEmpty: true,
      inputType: 'text'
    });
    expect(inputColumn.meta?.editableCell).toMatchObject({
      field: 'name',
      editor: 'input',
      allowEmpty: true,
      inputType: 'tel',
      inputMode: 'tel'
    });
    expect(inputColumn.meta?.editableChoice).toBeUndefined();
    expect(switchColumn.meta?.editableCell).toMatchObject({
      field: 'status',
      editor: 'switch',
      allowEmpty: false,
      checkedValue: 'ENABLED',
      uncheckedValue: 'DISABLED',
      checkedLabel: '启用',
      uncheckedLabel: '停用'
    });
    expect(switchColumn.meta?.editableChoice).toBeUndefined();
  });

  it('rejects invalid editable multiple selection limits at runtime', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();

    expect(() =>
      columnDsl.editableField('roleIds', '角色', {
        type: 'select',
        valueOptions: [{ value: 1, label: '管理员' }],
        edit: { selectionMode: 'multiple', maxSelected: 0 }
      })
    ).toThrow('maxSelected must be a positive integer');
  });

  it('creates typed numeric columns with machine-readable copy metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const numberColumn = columnDsl.editableField('amount', '数量', {
      type: 'number',
      edit: { allowEmpty: false, min: 0, step: 0.1 }
    });
    const moneyColumn = columnDsl.editableField('nullableAmount', '金额', {
      type: 'money',
      edit: { currency: 'CNY' }
    });
    const percentColumn = columnDsl.editableField('nullableAmount', '比例', {
      type: 'percent',
      edit: { min: percentPoints(5), max: percentPoints(100) }
    });

    expect(numberColumn.meta?.editableCell).toMatchObject({
      type: 'number',
      editor: 'number',
      allowEmpty: false,
      min: 0,
      step: 0.1
    });
    expect(moneyColumn.meta?.editableCell).toMatchObject({
      type: 'money',
      editor: 'number',
      currency: 'CNY'
    });
    expect(percentColumn.meta?.editableCell).toMatchObject({
      type: 'percent',
      min: 0.05,
      max: 1
    });
    expect(percentColumn.meta?.copyValue?.(0.125, {} as ChoiceRow)).toBe('12.5');
  });

  it('creates typed date columns with strict nullable metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const required = columnDsl.editableField('strictDate', '必填日期', {
      type: 'date',
      edit: {
        allowEmpty: false,
        min: '2026-01-01',
        max: '2026-12-31'
      }
    });
    const optional = columnDsl.editableField('effectiveDate', '生效日期', {
      type: 'date'
    });

    expect(required.meta?.editableCell).toMatchObject({
      type: 'date',
      editor: 'date',
      allowEmpty: false,
      min: '2026-01-01',
      max: '2026-12-31'
    });
    expect(optional.meta?.editableCell).toMatchObject({
      type: 'date',
      editor: 'date',
      allowEmpty: true,
      emptyValue: null
    });
  });

  it('creates typed dateTime columns with bound time zone metadata', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>({
      tableId: 'orders',
      tableTimeZone: 'Asia/Shanghai',
      appTimeZone: 'UTC'
    });
    const instant = columnDsl.editableField('executeAt', '执行时间', {
      type: 'dateTime',
      edit: {
        valueKind: 'instant',
        granularity: 'minute',
        step: 5
      }
    });
    const local = columnDsl.editableField('localStartsAt', '本地开始时间', {
      type: 'dateTime',
      edit: {
        valueKind: 'local',
        granularity: 'second',
        allowEmpty: false
      }
    });

    expect(instant.meta?.editableCell).toMatchObject({
      type: 'dateTime',
      editor: 'dateTime',
      valueKind: 'instant',
      timeZone: 'Asia/Shanghai',
      timeZoneSource: 'table',
      commitMode: 'explicit-confirm'
    });
    expect(local.meta?.editableCell).toMatchObject({
      type: 'dateTime',
      editor: 'dateTime',
      valueKind: 'local',
      timeZone: undefined
    });
  });

  it('fails closed to a read-only column when a disabled adapter bypasses the type gate', () => {
    const columnDsl = createDataTableColumnDsl<ChoiceRow>();
    const unsafeEditableField = columnDsl.editableField as unknown as (
      key: 'amount',
      title: string,
      options: { type: 'unsupported' }
    ) => ReturnType<typeof columnDsl.field>;

    const column = unsafeEditableField('amount', '未知类型', { type: 'unsupported' });

    expect(column.meta?.editableCell).toBeUndefined();
    expect(column.meta?.editableChoice).toBeUndefined();
  });

  it('expands the audit macro into stable create and update information columns', () => {
    const columns = createDataTableColumnDsl<AuditRow>().audit();
    const record: AuditRow = {
      id: 1,
      createById: 10001,
      createByName: 'sso-admin',
      createTime: '2026-08-01 10:00:00',
      updateById: null,
      updateByName: null,
      updateTime: null
    };
    const renderAuditCell = (column: (typeof columns)[number]) => {
      if (typeof column.cell !== 'function') return undefined;
      const cell = column.cell as unknown as (context: { row: { original: AuditRow } }) => unknown;
      return cell({ row: { original: record } });
    };

    expect(columns.map((column) => column.id)).toEqual(['createInfo', 'updateInfo']);
    expect(getNodeText(renderAuditCell(columns[0]!))).toBe('sso-admin2026-08-01 10:00:00');
    expect(getNodeText(renderAuditCell(columns[1]!))).toBe('--');
  });
});

function expectColumnDslTypeErrors() {
  const columnDsl = createDataTableColumnDsl<Row>();
  const choiceColumnDsl = createDataTableColumnDsl<ChoiceRow>();
  const auditColumnDsl = createDataTableColumnDsl<AuditRow>();
  const filterObjectApi = { variant: 'text' };
  const disabledSerializeFilter = false;

  auditColumnDsl.audit();
  // @ts-expect-error audit macro requires compatible create/update audit fields
  columnDsl.audit();

  // @ts-expect-error filter object API is forbidden
  columnDsl.field('name', '名称', { filter: filterObjectApi });

  // @ts-expect-error serializeFilter only accepts a function
  columnDsl.field('name', '名称', { dsl: { serializeFilter: disabledSerializeFilter } });

  // @ts-expect-error size only accepts a known preset or an exact number
  columnDsl.field('name', '名称', { size: 'huge' });

  choiceColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [{ value: 'ENABLED', label: '启用' }],
    edit: { selectionMode: 'single' }
  });
  choiceColumnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: [{ value: 1, label: '管理员' }],
    edit: { selectionMode: 'multiple', maxSelected: 2 }
  });
  choiceColumnDsl.editableField('name', '手机号', {
    type: 'text',
    edit: { control: 'input', inputType: 'tel' }
  });
  choiceColumnDsl.editableField('status', '状态', {
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
  });

  choiceColumnDsl.editableField('strictRemark', '备注', {
    type: 'longText',
    edit: { control: 'textarea' }
  });
  choiceColumnDsl.editableField('remark', '可空备注', {
    type: 'longText',
    edit: { control: 'textarea', emptyValue: null }
  });

  choiceColumnDsl.editableField('amount', '数量', {
    type: 'int',
    edit: { allowEmpty: false, min: 0, step: 1 }
  });
  choiceColumnDsl.editableField('nullableAmount', '金额', {
    type: 'money',
    edit: { currency: 'CNY' }
  });
  choiceColumnDsl.editableField('nullableAmount', '比例', {
    type: 'percent',
    edit: { maxFractionDigits: 2 }
  });
  choiceColumnDsl.editableField('optionalAmount', '可空数值', {
    type: 'decimal',
    edit: { allowEmpty: true, emptyValue: undefined }
  });
  choiceColumnDsl.editableField('strictDate', '必填日期', {
    type: 'date',
    edit: { allowEmpty: false }
  });
  choiceColumnDsl.editableField('effectiveDate', '生效日期', {
    type: 'date'
  });
  choiceColumnDsl.editableField('executeAt', '执行时间', {
    type: 'dateTime',
    edit: { valueKind: 'instant', timeZone: 'Asia/Shanghai' }
  });
  choiceColumnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: { valueKind: 'local', allowEmpty: false }
  });

  // @ts-expect-error textarea cannot target a number field
  choiceColumnDsl.editableField('amount', '金额备注', {
    type: 'longText',
    edit: { control: 'textarea' }
  });

  // @ts-expect-error emptyValue null requires a nullable string field
  choiceColumnDsl.editableField('strictRemark', '严格备注', {
    type: 'longText',
    edit: { control: 'textarea', emptyValue: null }
  });

  // @ts-expect-error numeric editors cannot target string fields
  choiceColumnDsl.editableField('name', '数量', {
    type: 'number'
  });

  // @ts-expect-error non-nullable number fields must explicitly reject empty input
  choiceColumnDsl.editableField('amount', '数量', {
    type: 'number'
  });

  // @ts-expect-error null empty values require a nullable number field
  choiceColumnDsl.editableField('amount', '数量', {
    type: 'number',
    edit: { allowEmpty: true, emptyValue: null }
  });

  // @ts-expect-error undefined empty values require an optional number field
  choiceColumnDsl.editableField('nullableAmount', '金额', {
    type: 'money',
    edit: { allowEmpty: true, emptyValue: undefined }
  });

  // @ts-expect-error optional number fields must explicitly select undefined or reject empty input
  choiceColumnDsl.editableField('optionalAmount', '可空数值', {
    type: 'decimal',
    edit: { allowEmpty: true }
  });

  // @ts-expect-error date editors cannot target number fields
  choiceColumnDsl.editableField('amount', '日期', {
    type: 'date',
    edit: { allowEmpty: false }
  });

  // @ts-expect-error non-nullable date fields must explicitly reject empty input
  choiceColumnDsl.editableField('strictDate', '必填日期', {
    type: 'date'
  });

  // @ts-expect-error nullable date values are required when allowEmpty is enabled
  choiceColumnDsl.editableField('strictDate', '必填日期', {
    type: 'date',
    edit: { allowEmpty: true, emptyValue: null }
  });

  // @ts-expect-error undefined is not part of the Date Editor domain contract
  choiceColumnDsl.editableField('optionalDate', '可选日期', {
    type: 'date',
    edit: { allowEmpty: false }
  });

  // @ts-expect-error dateTime valueKind is required
  choiceColumnDsl.editableField('executeAt', '执行时间', {
    type: 'dateTime',
    edit: { timeZone: 'Asia/Shanghai' }
  });

  // @ts-expect-error local dateTime cannot configure an instant time zone
  choiceColumnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: { valueKind: 'local', timeZone: 'Asia/Shanghai', allowEmpty: false }
  });

  // @ts-expect-error non-nullable dateTime fields must reject empty input
  choiceColumnDsl.editableField('localStartsAt', '本地开始时间', {
    type: 'dateTime',
    edit: { valueKind: 'local' }
  });

  // @ts-expect-error dateTime editors cannot target number fields
  choiceColumnDsl.editableField('amount', '执行时间', {
    type: 'dateTime',
    edit: { valueKind: 'instant', timeZone: 'UTC', allowEmpty: false }
  });

  // @ts-expect-error scalar fields cannot use multiple selection
  choiceColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [{ value: 'ENABLED', label: '启用' }],
    edit: { selectionMode: 'multiple' }
  });

  choiceColumnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: [{ value: 1, label: '管理员' }],
    // @ts-expect-error array fields cannot use single selection
    edit: { selectionMode: 'single' }
  });

  // @ts-expect-error non-choice fields cannot use editableField
  choiceColumnDsl.editableField('name', '名称', {
    type: 'select',
    valueOptions: [{ value: 'A', label: 'A' }],
    edit: { selectionMode: 'multiple' }
  });

  // @ts-expect-error maxSelected belongs to multiple selection only
  choiceColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [{ value: 'ENABLED', label: '启用' }],
    edit: { selectionMode: 'single', maxSelected: 2 }
  });
}

void expectColumnDslTypeErrors;
