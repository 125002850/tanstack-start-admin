import * as React from 'react';

import { Icons } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/table/data-table';
import type {
  DataTableAction,
  DataTableActionContext
} from '@/components/ui/table/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/data-table-row-action';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import { useDataTable } from '@/hooks/use-data-table';

import type {
  DictionaryItemMutationPayload,
  DictionaryItemRecord,
  DictionaryTypeRecord
} from '../api/types';
import { DictionaryItemSheet } from './dictionary-item-sheet';
import { dictionaryItemColumns } from './dictionary-items-columns';

interface DictionaryItemsPanelProps {
  record: DictionaryTypeRecord | null;
  items: DictionaryItemRecord[];
  isRefreshing: boolean;
  onItemSubmit: (payload: DictionaryItemMutationPayload) => Promise<void>;
  onRefresh: () => Promise<void>;
  onDelete: (item: DictionaryItemRecord) => void;
  onBulkDelete: (payload: { dictTypeCode: string; ids: number[] }) => Promise<void>;
}

export function DictionaryItemsPanel({
  record,
  items,
  isRefreshing,
  onItemSubmit,
  onRefresh,
  onDelete,
  onBulkDelete
}: DictionaryItemsPanelProps) {
  const [addSheetOpen, setAddSheetOpen] = React.useState(false);
  const { withConfirm: withBatchConfirm, confirmDialog: batchConfirmDialog } =
    useConfirmAction<[DataTableActionContext<DictionaryItemRecord>]>();

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
                dictTypeCode={item.dictTypeCode}
                item={item}
                onSubmit={onItemSubmit}
                onDelete={onDelete}
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
        onClick: (item) => onDelete(item)
      }
    ],
    [onItemSubmit, onDelete]
  );

  const { table, clearSelectedRows, getSelectedRows } = useDataTable({
    data: items,
    columns: dictionaryItemColumns,
    pageCount: 1,
    showRowNumberColumn: false,
    showSelectColumn: true,
    rowActions,
    tableId: record ? `dictionary-items-${record.dictTypeCode}` : 'dictionary-items-empty'
  });

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
        label: '刷新列表',
        icon: <Icons.chevronsDown className='size-3.5' />,
        disabled: !record || isRefreshing,
        callback: () => void onRefresh()
      },
      {
        label: '批量删除',
        icon: <Icons.trash className='size-3.5' />,
        type: 'danger' as const,
        hidden: (ctx) => ctx.selectedRows.length === 0,
        callback: withBatchConfirm({
          title: (ctx) => `确认删除 ${ctx.selectedRows.length} 个字典项？`,
          description: '删除后不可恢复。',
          confirmText: '批量删除',
          cancelText: '取消',
          run: async (ctx) => {
            if (!record) return;
            const ids = ctx.selectedRows.map((row) => row.id);
            await onBulkDelete({ dictTypeCode: record.dictTypeCode, ids });
            clearSelectedRows();
          }
        })
      }
    ],
    [clearSelectedRows, isRefreshing, onRefresh, record, onBulkDelete, withBatchConfirm]
  );

  return (
    <Card>
      {batchConfirmDialog}
      {record && (
        <DictionaryItemSheet
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          dictTypeCode={record.dictTypeCode}
          item={null}
          onSubmit={onItemSubmit}
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
          getSelectedRows={getSelectedRows}
          getStatusConfig={() => {
            if (!record) {
              return {
                type: 'empty',
                title: '请先选择字典类型',
                description: '左侧选择后可查看并维护当前字典类型'
              };
            }
            if (!items.length) {
              return { type: 'empty', title: '当前字典类型暂无字典项', description: '' };
            }
          }}
          statusDeps={[record, items.length]}
        />
      </CardContent>
    </Card>
  );
}
