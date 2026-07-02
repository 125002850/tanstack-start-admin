import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';

import { useConfirmAction } from '@/hooks/use-confirm-action';
import { useDataTable } from '@/hooks/use-data-table';
import { DictStatus } from '@/constants/enums';

import {
  mdmDictGlobalItemCreateMutationOptions,
  mdmDictGlobalItemDeleteMutationOptions,
  mdmDictGlobalItemUpdateMutationOptions,
  mdmDictGlobalTypesListAllQueryOptions,
  mdmDictGlobalTypeCreateMutationOptions,
  mdmDictGlobalTypeDeleteMutationOptions,
  mdmDictGlobalTypeUpdateMutationOptions,
  type MdmDictGlobalItemCreateRequest,
  type MdmDictGlobalItemDeleteRequest,
  type MdmDictGlobalItemUpdateRequest,
  type MdmDictGlobalTypesListAllRequest,
  type MdmDictGlobalTypeCreateRequest,
  type MdmDictGlobalTypeDeleteRequest,
  type MdmDictGlobalTypeUpdateRequest
} from '@/lib/api/clients/service';
import type {
  DictionaryItemMutationPayload,
  DictionaryItemRecord,
  DictionaryTypeMutationPayload,
  DictionaryTypeRecord
} from '../api/types';
import { DICTIONARY_ITEMS_BY_TYPE_QUERY_KEY_PREFIX } from '../api/query-options';
import {
  dictionaryTypeColumns,
  DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID
} from './dictionary-type-columns';
import { DictionaryItemsPanel } from './dictionary-items-panel';
import { DictionaryTypeDetails } from './dictionary-type-details';
import { DictionaryTypeList } from './dictionary-type-list';
import { DictionaryTypeSheet } from './dictionary-type-sheet';

const EMPTY_DICTIONARY_TYPES: DictionaryTypeRecord[] = [];

export default function DictionaryManagementPage() {
  return <DictionaryManagementContent />;
}

function DictionaryManagementContent() {
  const queryClient = useQueryClient();
  const [requestedTypeCode, setRequestedTypeCode] = React.useState<string | null>(null);
  const [selectedTypeItemTotal, setSelectedTypeItemTotal] = React.useState(0);
  const { table: dictionaryTypeTable } = useDataTable({
    tableId: 'dictionary-types',
    data: EMPTY_DICTIONARY_TYPES,
    columns: dictionaryTypeColumns,
    pageCount: 1
  });
  const dictionaryTypeKeyword =
    (
      dictionaryTypeTable.getColumn(DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID)?.getFilterValue() as
        | string
        | undefined
    )?.trim() || undefined;
  const dictionaryTypeRequest = React.useMemo(
    () => ({ keyword: dictionaryTypeKeyword }) satisfies MdmDictGlobalTypesListAllRequest,
    [dictionaryTypeKeyword]
  );
  const dictionaryTypeQuery = useQuery({
    ...mdmDictGlobalTypesListAllQueryOptions(dictionaryTypeRequest),
    placeholderData: keepPreviousData
  });

  // Sheet state: null = closed, { type: record } = editing, { type: null } = creating
  const [sheetState, setSheetState] = React.useState<{
    type?: DictionaryTypeRecord | null;
  } | null>(null);

  const dictionaryTypes = dictionaryTypeQuery.data ?? EMPTY_DICTIONARY_TYPES;

  const selectedType =
    dictionaryTypes.find((record) => record.dictTypeCode === requestedTypeCode) ??
    dictionaryTypes[0] ??
    null;

  const createTypeMutation = useMutation(mdmDictGlobalTypeCreateMutationOptions());
  const updateTypeMutation = useMutation(mdmDictGlobalTypeUpdateMutationOptions());
  const createItemMutation = useMutation(mdmDictGlobalItemCreateMutationOptions());
  const updateItemMutation = useMutation(mdmDictGlobalItemUpdateMutationOptions());
  const deleteItemMutation = useMutation(mdmDictGlobalItemDeleteMutationOptions());
  const deleteTypeMutation = useMutation(mdmDictGlobalTypeDeleteMutationOptions());
  const invalidateDictionaryItems = React.useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: DICTIONARY_ITEMS_BY_TYPE_QUERY_KEY_PREFIX,
        exact: false
      }),
    [queryClient]
  );

  const handleTypeSubmit = React.useCallback(
    async (payload: DictionaryTypeMutationPayload) => {
      try {
        if (payload.id === 0) {
          await createTypeMutation.mutateAsync(payload as MdmDictGlobalTypeCreateRequest);
          toast.success('字典类型已创建');
        } else {
          await updateTypeMutation.mutateAsync(payload as MdmDictGlobalTypeUpdateRequest);
          toast.success('字典类型已更新');
        }
        setSheetState(null);
      } catch {
        toast.error(payload.id === 0 ? '字典类型创建失败' : '字典类型更新失败');
      }
    },
    [createTypeMutation, updateTypeMutation]
  );

  const handleItemSubmit = React.useCallback(
    async (payload: DictionaryItemMutationPayload) => {
      try {
        if (payload.id) {
          await updateItemMutation.mutateAsync(payload as MdmDictGlobalItemUpdateRequest);
          await invalidateDictionaryItems();
          toast.success('字典项已更新');
          return;
        }

        await createItemMutation.mutateAsync(payload as MdmDictGlobalItemCreateRequest);
        await invalidateDictionaryItems();
        toast.success('字典项已新增');
      } catch {
        toast.error(payload.id ? '字典项更新失败' : '字典项新增失败');
      }
    },
    [createItemMutation, invalidateDictionaryItems, updateItemMutation]
  );

  const handleDelete = React.useCallback(
    async (item: DictionaryItemRecord) => {
      try {
        await deleteItemMutation.mutateAsync({ ids: [item.id] } as MdmDictGlobalItemDeleteRequest);
        await invalidateDictionaryItems();
        toast.success('字典项已删除');
      } catch {
        toast.error('字典项删除失败');
      }
    },
    [deleteItemMutation, invalidateDictionaryItems]
  );

  const handleBulkDelete = React.useCallback(
    async (payload: { ids: number[] }) => {
      try {
        await deleteItemMutation.mutateAsync(payload as MdmDictGlobalItemDeleteRequest);
        await invalidateDictionaryItems();
        toast.success('已批量删除字典项');
      } catch (error) {
        toast.error('批量删除字典项失败');
        throw error;
      }
    },
    [deleteItemMutation, invalidateDictionaryItems]
  );

  const { withConfirm: withToggleItemConfirm, confirmDialog: toggleItemConfirmDialog } =
    useConfirmAction<[DictionaryItemRecord]>();

  const handleToggleItemStatus = withToggleItemConfirm({
    title: (record) => {
      const isCurrentlyEnabled = record.status === DictStatus.ENABLE;
      return isCurrentlyEnabled
        ? `确认停用字典项「${record.dictItemName}」？`
        : `确认启用字典项「${record.dictItemName}」？`;
    },
    description: '切换启用状态不会影响历史数据。',
    confirmText: '确认切换',
    cancelText: '取消',
    run: async (record) => {
      const newStatus =
        record.status === DictStatus.ENABLE ? DictStatus.DISABLE : DictStatus.ENABLE;
      await updateItemMutation.mutateAsync({
        id: record.id!,
        dictTypeCode: record.dictTypeCode!,
        dictItemCode: record.dictItemCode!,
        dictItemName: record.dictItemName!,
        status: newStatus,
        sortOrder: record.sort,
        remark: record.remark
      } as MdmDictGlobalItemUpdateRequest);
      await invalidateDictionaryItems();
      toast.success('字典项状态已切换');
    }
  });

  const { withConfirm: withTypeDeleteConfirm, confirmDialog: typeDeleteConfirmDialog } =
    useConfirmAction<[]>();

  const handleDeleteTypeClick = React.useCallback(() => {
    if (!selectedType) return;
    if (selectedTypeItemTotal > 0) {
      toast.warning(`请先删除「${selectedType.dictTypeName}」下的所有字典项`);
      return;
    }
    void withTypeDeleteConfirm({
      title: `删除字典类型「${selectedType.dictTypeName}」？`,
      description: '删除后不可恢复。',
      confirmText: '删除',
      cancelText: '取消',
      run: async () => {
        try {
          await deleteTypeMutation.mutateAsync({
            id: selectedType.id
          } as MdmDictGlobalTypeDeleteRequest);
          toast.success('字典类型已删除');
        } catch (error) {
          toast.error('字典类型删除失败');
          throw error;
        }
      }
    })();
  }, [selectedType, selectedTypeItemTotal, deleteTypeMutation, withTypeDeleteConfirm]);

  return (
    <>
      {typeDeleteConfirmDialog}
      {toggleItemConfirmDialog}
      <DictionaryTypeSheet
        open={sheetState !== null}
        onOpenChange={(open) => {
          if (!open) setSheetState(null);
        }}
        type={sheetState?.type ?? null}
        onSubmit={handleTypeSubmit}
      />
      {dictionaryTypeQuery.isLoading && dictionaryTypes.length === 0 ? (
        <DictionaryManagementFallback />
      ) : (
        <div className='grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start'>
          <DictionaryTypeList
            table={dictionaryTypeTable}
            types={dictionaryTypes}
            selectedTypeCode={selectedType?.dictTypeCode ?? null}
            onSelect={(dictTypeCode) => {
              setRequestedTypeCode(dictTypeCode);
            }}
            onAddType={() => setSheetState({ type: null })}
          />

          <div className='min-w-0 space-y-4'>
            <DictionaryTypeDetails
              record={selectedType}
              onEdit={() => setSheetState({ type: selectedType })}
              onDelete={selectedType ? handleDeleteTypeClick : undefined}
            />

            <DictionaryItemsPanel
              record={selectedType}
              onTotalChange={setSelectedTypeItemTotal}
              onItemSubmit={handleItemSubmit}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
              onToggleItemStatus={handleToggleItemStatus}
            />
          </div>
        </div>
      )}
    </>
  );
}

function DictionaryManagementFallback() {
  return (
    <div className='rounded-xl border border-dashed bg-card px-4 py-10 text-sm text-muted-foreground'>
      加载字典数据中...
    </div>
  );
}
