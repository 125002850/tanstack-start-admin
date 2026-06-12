import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { toast } from 'sonner';

import PageContainer from '@/components/layout/page-container';
import { useConfirmAction } from '@/hooks/use-confirm-action';

import {
  createGlobalItemPreciseInvalidationMutationOptions,
  createGlobalTypeMutationOptions,
  deleteGlobalItemMutationOptions,
  deleteGlobalTypeMutationOptions,
  listGlobalTypesQueryOptions,
  listGlobalItemsByTypeQueryOptions,
  updateGlobalItemPreciseInvalidationMutationOptions,
  updateGlobalTypeMutationOptions,
  type CreateGlobalItemRequest,
  type CreateGlobalTypeRequest,
  type DeleteGlobalItemRequest,
  type DeleteGlobalTypeRequest,
  type UpdateGlobalItemRequest,
  type UpdateGlobalTypeRequest
} from '@/lib/api/clients/service';
import type {
  DictionaryItemMutationPayload,
  DictionaryItemRecord,
  DictionaryTypeMutationPayload,
  DictionaryTypeRecord
} from '../api/types';
import { DictionaryItemsPanel } from './dictionary-items-panel';
import { DictionaryTypeDetails } from './dictionary-type-details';
import { DictionaryTypeList } from './dictionary-type-list';
import { DictionaryTypeSheet } from './dictionary-type-sheet';

const EMPTY_DICTIONARY_TYPES: DictionaryTypeRecord[] = [];

export default function DictionaryManagementPage() {
  return (
    <PageContainer>
      <DictionaryManagementContent />
    </PageContainer>
  );
}

function DictionaryManagementContent() {
  const { data: dictionaryTypeResult, isLoading: typesLoading } = useQuery(
    listGlobalTypesQueryOptions({ pageNo: 1, pageSize: 200 })
  );
  const [keyword, setKeyword] = React.useState('');
  const [requestedTypeCode, setRequestedTypeCode] = React.useState<string | null>(null);

  // Sheet state: null = closed, { type: record } = editing, { type: null } = creating
  const [sheetState, setSheetState] = React.useState<{
    type?: DictionaryTypeRecord | null;
  } | null>(null);

  const dictionaryTypes = dictionaryTypeResult?.list ?? EMPTY_DICTIONARY_TYPES;

  const filteredTypes = React.useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return dictionaryTypes;
    }

    return dictionaryTypes.filter((record) => {
      return (
        record.dictTypeCode!.toLowerCase().includes(normalized) ||
        record.dictTypeName!.toLowerCase().includes(normalized)
      );
    });
  }, [dictionaryTypes, keyword]);

  const selectedType =
    filteredTypes.find((record) => record.dictTypeCode === requestedTypeCode) ??
    filteredTypes[0] ??
    null;

  const itemsQuery = useQuery({
    ...listGlobalItemsByTypeQueryOptions({ dictTypeCode: selectedType?.dictTypeCode ?? '' }),
    enabled: Boolean(selectedType)
  });
  const items = itemsQuery.data ?? [];

  const createTypeMutation = useMutation(createGlobalTypeMutationOptions());
  const updateTypeMutation = useMutation(updateGlobalTypeMutationOptions());
  const createItemMutation = useMutation(createGlobalItemPreciseInvalidationMutationOptions());
  const updateItemMutation = useMutation(updateGlobalItemPreciseInvalidationMutationOptions());
  const deleteItemMutation = useMutation(deleteGlobalItemMutationOptions());
  const deleteTypeMutation = useMutation(deleteGlobalTypeMutationOptions());

  const handleTypeSubmit = React.useCallback(
    async (payload: DictionaryTypeMutationPayload) => {
      try {
        if (payload.id === 0) {
          await createTypeMutation.mutateAsync(payload as CreateGlobalTypeRequest);
          toast.success('字典类型已创建');
        } else {
          await updateTypeMutation.mutateAsync(payload as UpdateGlobalTypeRequest);
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
          await updateItemMutation.mutateAsync(payload as UpdateGlobalItemRequest);
          toast.success('字典项已更新');
          return;
        }

        await createItemMutation.mutateAsync(payload as CreateGlobalItemRequest);
        toast.success('字典项已新增');
      } catch {
        toast.error(payload.id ? '字典项更新失败' : '字典项新增失败');
      }
    },
    [createItemMutation, updateItemMutation]
  );

  const handleDelete = React.useCallback(
    async (item: DictionaryItemRecord) => {
      try {
        await deleteItemMutation.mutateAsync({ ids: [item.id] } as DeleteGlobalItemRequest);
        toast.success('字典项已删除');
      } catch {
        toast.error('字典项删除失败');
      }
    },
    [deleteItemMutation]
  );

  const handleBulkDelete = React.useCallback(
    async (payload: { ids: number[] }) => {
      try {
        await deleteItemMutation.mutateAsync(payload as DeleteGlobalItemRequest);
        toast.success('已批量删除字典项');
      } catch (error) {
        toast.error('批量删除字典项失败');
        throw error;
      }
    },
    [deleteItemMutation]
  );

  const { withConfirm: withTypeDeleteConfirm, confirmDialog: typeDeleteConfirmDialog } =
    useConfirmAction<[]>();

  const handleDeleteTypeClick = React.useCallback(() => {
    if (!selectedType) return;
    if (items.length > 0) {
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
          await deleteTypeMutation.mutateAsync({ id: selectedType.id } as DeleteGlobalTypeRequest);
          toast.success('字典类型已删除');
        } catch (error) {
          toast.error('字典类型删除失败');
          throw error;
        }
      }
    })();
  }, [selectedType, items.length, deleteTypeMutation, withTypeDeleteConfirm]);

  const handleRefresh = React.useCallback(async () => {
    const result = await itemsQuery.refetch();
    if (result.error) {
      toast.error('列表刷新失败');
      return;
    }

    toast.success('列表已刷新');
  }, [itemsQuery]);

  return (
    <>
      {typeDeleteConfirmDialog}
      <DictionaryTypeSheet
        open={sheetState !== null}
        onOpenChange={(open) => {
          if (!open) setSheetState(null);
        }}
        type={sheetState?.type ?? null}
        onSubmit={handleTypeSubmit}
      />
      {typesLoading && dictionaryTypes.length === 0 ? (
        <DictionaryManagementFallback />
      ) : (
        <div className='grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start'>
          <DictionaryTypeList
            types={filteredTypes}
            selectedTypeCode={selectedType?.dictTypeCode ?? null}
            keyword={keyword}
            onKeywordChange={setKeyword}
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
              items={items}
              isRefreshing={itemsQuery.isFetching}
              onItemSubmit={handleItemSubmit}
              onRefresh={handleRefresh}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
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
