import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/table/core/data-table';
import type {
  DataTableAction,
  DataTableActionContext
} from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslCondition } from '@/hooks/use-dsl-data-table.dsl';
import type { MdmDictGlobalItemsByTypeResponse } from '@/lib/api/clients/service';

import type {
  DictionaryItemMutationPayload,
  DictionaryItemRecord,
  DictionaryTypeRecord
} from '../api/types';
import {
  dictionaryItemsByTypeQueryOptions,
  type DictionaryItemsQueryRequest
} from '../api/query-options';
import { DictionaryItemSheet } from './dictionary-item-sheet';
import { dictionaryItemColumns } from './dictionary-items-columns';

interface DictionaryItemsPanelProps {
  record: DictionaryTypeRecord | null;
  onTotalChange: (total: number) => void;
  onItemSubmit: (payload: DictionaryItemMutationPayload) => Promise<void>;
  onDelete: (item: DictionaryItemRecord) => void;
  onBulkDelete: (payload: { ids: number[] }) => Promise<void>;
  onToggleItemStatus: (record: DictionaryItemRecord) => void;
}

const NOOP = () => {};

export function DictionaryItemsPanel({
  record,
  onTotalChange,
  onItemSubmit,
  onDelete,
  onBulkDelete,
  onToggleItemStatus
}: DictionaryItemsPanelProps) {
  const [addSheetOpen, setAddSheetOpen] = React.useState(false);
  const { withConfirm: withBatchConfirm, confirmDialog: batchConfirmDialog } =
    useConfirmAction<[DataTableActionContext<DictionaryItemRecord>]>();
  const tableId = 'dictionary-items';

  const refetchRef = React.useRef<() => void>(NOOP);

  const handleItemSubmit = React.useCallback(
    async (payload: DictionaryItemMutationPayload) => {
      await onItemSubmit(payload);
      refetchRef.current();
    },
    [onItemSubmit]
  );

  const handleDelete = React.useCallback(
    async (item: DictionaryItemRecord) => {
      await onDelete(item);
      refetchRef.current();
    },
    [onDelete]
  );

  const handleBulkDelete = React.useCallback(
    async (payload: { ids: number[] }) => {
      await onBulkDelete(payload);
      refetchRef.current();
    },
    [onBulkDelete]
  );

  const rowActions = React.useMemo<DataTableRowAction<DictionaryItemRecord>[]>(
    () => [
      {
        label: '编辑',
        icon: <Icons.edit className='size-4' />,
        Sheet: ({
          data: item,
          open,
          onOpenChange
        }: {
          data: DictionaryItemRecord;
          open: boolean;
          onOpenChange: (open: boolean) => void;
        }) => (
          <DictionaryItemSheet
            open={open}
            onOpenChange={onOpenChange}
            dictTypeCode={item.dictTypeCode!}
            item={item}
            onSubmit={handleItemSubmit}
            onDelete={handleDelete}
          />
        )
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        confirmDelete: {
          title: '确认删除',
          description: (item) => `确定要删除字典项「${item.dictItemName}」吗？删除后不可恢复。`,
          confirmText: '删除',
          cancelText: '取消'
        },
        onClick: (item) => handleDelete(item)
      }
    ],
    [handleItemSubmit, handleDelete]
  );

  const baseCondition = React.useMemo<DataTableDslCondition | undefined>(() => {
    if (!record?.dictTypeCode) {
      return undefined;
    }

    return {
      nodeType: 'text',
      field: 'dictTypeCode',
      op: 'EQ',
      value: record.dictTypeCode
    };
  }, [record?.dictTypeCode]);

  const mapQueryData = React.useCallback(
    (data: MdmDictGlobalItemsByTypeResponse | undefined) => ({
      total: data?.total ?? 0,
      list:
        data?.list?.map((item) => ({
          ...item,
          sort: item.sortOrder
        })) ?? []
    }),
    []
  );

  const dictionaryItemsQueryOptions = React.useCallback(
    (request: DictionaryItemsQueryRequest) => ({
      ...dictionaryItemsByTypeQueryOptions(request),
      enabled: Boolean(record?.dictTypeCode)
    }),
    [record?.dictTypeCode]
  );

  const { table, total, clearSelectedRows, getSelectedRows, queryState, refreshProps } =
    useDslDataTable<
      DictionaryItemRecord,
      DictionaryItemsQueryRequest,
      MdmDictGlobalItemsByTypeResponse,
      ApiClientError,
      readonly ['service', 'mdm-dict-global-items-by-type', DictionaryItemsQueryRequest]
    >({
      columns: dictionaryItemColumns(onToggleItemStatus),
      tableId,
      queryOptions: dictionaryItemsQueryOptions,
      baseCondition,
      mapQueryData,
      showRowNumberColumn: false,
      showSelectColumn: true,
      rowId: 'id',
      rowSelectionScopeKey: record?.dictTypeCode ?? null,
      rowActions,
      refreshBehavior: {
        onSuccess: () => {
          toast.success('列表已刷新');
        }
      }
    });

  React.useEffect(() => {
    refetchRef.current = queryState.refetch;
  });

  const isInitialLoading = queryState.isFetching && !queryState.data;

  React.useEffect(() => {
    onTotalChange(record ? total : 0);
  }, [onTotalChange, record, total]);

  const actions = React.useMemo<DataTableAction<DictionaryItemRecord>[]>(
    () => [
      {
        label: '新增字典项',
        icon: <Icons.add className='size-3.5' />,
        disabled: !record,
        callback: () => {
          setAddSheetOpen(true);
        }
      },
      {
        kind: 'selection',
        label: '批量删除',
        icon: <Icons.trash className='size-3.5' />,
        type: 'danger' as const,
        callback: withBatchConfirm({
          title: (ctx) => `确认删除 ${ctx.selectedRows.length} 个字典项？`,
          description: '删除后不可恢复。',
          confirmText: '批量删除',
          cancelText: '取消',
          run: async (ctx) => {
            if (!record?.dictTypeCode) return;
            const ids = ctx.selectedRows.map((row) => row.id!).filter(Boolean);
            await handleBulkDelete({ ids });
            clearSelectedRows();
          }
        })
      }
    ],
    [record, handleBulkDelete, clearSelectedRows, withBatchConfirm]
  );

  return (
    <Card>
      {batchConfirmDialog}
      {record && (
        <DictionaryItemSheet
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          dictTypeCode={record.dictTypeCode!}
          item={null}
          onSubmit={handleItemSubmit}
        />
      )}
      <CardHeader>
        <div className='space-y-1'>
          <CardTitle>字典项列表</CardTitle>
          <CardDescription>
            {record
              ? `当前类型：${record.dictTypeName}（${record.dictTypeCode}）`
              : '请先选择字典类型'}
          </CardDescription>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className='min-h-0 flex-1 px-0'>
        <DataTable
          table={table}
          tableActions={actions}
          statusTotalCount={total}
          isLoading={isInitialLoading}
          getSelectedRows={getSelectedRows}
          {...refreshProps}
          getStatusConfig={({ rows, hasFilters, isLoading }) => {
            if (!record) {
              return {
                type: 'onboarding',
                title: '请先选择字典类型',
                description: '左侧选择后可查看并维护当前字典类型'
              };
            }
            if (!rows.length && !isLoading) {
              if (hasFilters) {
                return {
                  type: 'empty',
                  title: '未找到匹配的字典项',
                  description: '尝试调整字典项编码或名称筛选条件。'
                };
              }

              return { type: 'empty', title: '当前字典类型暂无字典项', description: '' };
            }
          }}
        >
          <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
        </DataTable>
      </CardContent>
    </Card>
  );
}
