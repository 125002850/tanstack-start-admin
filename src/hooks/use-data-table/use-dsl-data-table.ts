import * as React from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  type QueryKey,
  type UseQueryResult
} from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import {
  createQuerySchemeMutationOptions,
  deleteQuerySchemeMutationOptions,
  listQuerySchemesQueryOptions,
  updateDefaultQuerySchemeMutationOptions,
  updateQuerySchemeMutationOptions
} from '@/lib/api/clients/service';
import {
  buildQuerySchemeContent,
  countAdvancedConditions,
  parseQuerySchemeContent,
  resolveQuerySchemes,
  summarizeAdvancedCondition,
  validateCombinedCondition
} from '@/lib/data-table/advanced-search';
import { useQuerySceneMetadata } from './use-query-scene-metadata';

import type {
  DataTableAdvancedSearchConfig,
  DataTableAdvancedSearchRuntime,
  ExtendedColumnSort
} from '@/types/data-table';

import {
  buildDataTableDslRequest,
  buildDataTableDslQuickConditions,
  isDataTableDslFilterVariantSupported,
  type DataTableDslCondition,
  type DataTableDslPageRequestBase,
  type DataTableDslSortItem,
  type PaginatedResponse,
  type QueryOptionsFactory
} from './dsl';
import type { UseDataTableProps } from './types';
import { useDataTable, useDataTableRuntime } from './use-data-table';
import { useDataTablePageSize } from './use-data-table-page-size';

/**
 * 基于 DSL 后端查询的 DataTable hook。
 *
 * 在 useDataTable 之上接入 React Query：根据分页、排序和 columnFilters 构建后端请求，
 * 查询结果再映射回 DataTable 所需的 data/total，同时提供刷新按钮所需状态。
 */
export type QueryStateSubset<TQueryData, TError> = Pick<
  UseQueryResult<TQueryData, TError>,
  'data' | 'isFetching' | 'error' | 'isError' | 'refetch'
>;

export type RefreshBehavior<TError> = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: TError) => void | Promise<void>;
};

export type RefreshProps = {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

type UseDslDataTableInitialState<TData> = Omit<
  NonNullable<UseDataTableProps<TData>['initialState']>,
  'pagination'
> & {
  pagination?: Omit<
    NonNullable<NonNullable<UseDataTableProps<TData>['initialState']>['pagination']>,
    'pageSize'
  >;
};

export type UseDslDataTableProps<
  TData,
  TRequest = DataTableDslPageRequestBase,
  TQueryData = PaginatedResponse<TData>,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey
> = Omit<
  UseDataTableProps<TData>,
  | 'data'
  | 'columns'
  | 'initialState'
  | 'pageCount'
  | 'totalCount'
  | 'tableId'
  | 'pageSize'
  | 'onPageSizeChange'
  | 'sortingMode'
> & {
  tableId: string;
  /** 查询场景编码；传入后启用高级搜索和个人查询方案。 */
  sceneCode?: string;
  advancedSearchFields?: Readonly<Record<string, DataTableAdvancedSearchConfig>>;
  columns: Array<ColumnDef<TData>>;
  initialState?: UseDslDataTableInitialState<TData>;
  queryOptions: QueryOptionsFactory<TData, TRequest, TQueryData, TError, TQueryKey>;
  baseCondition?: DataTableDslCondition;
  defaultRequestSort?: Array<DataTableDslSortItem>;
  defaultSort?: ExtendedColumnSort<TData>[];
  mapQueryData?: (data: TQueryData | undefined) => PaginatedResponse<TData>;
  refreshBehavior?: RefreshBehavior<TError>;
  /** 是否启用 DataTable 斑马纹。默认 `true`。 */
  enableZebraStriping?: boolean;
};

export type UseDslDataTableResult<TData, TQueryData, TError> = ReturnType<
  typeof useDataTable<TData>
> & {
  total: number;
  queryState: QueryStateSubset<TQueryData, TError>;
  refreshProps?: RefreshProps;
};

const warnedUnsupportedFilterVariants = new Set<string>();

type ResolvedDslData<TData> = PaginatedResponse<TData> & {
  pageNo: number;
  scopeKey: string;
};

function stableSerializeScope(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerializeScope).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${stableSerializeScope(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function getDslEditingScopeKey(request: unknown) {
  if (!request || typeof request !== 'object') return stableSerializeScope(request);
  const { pageNo: _pageNo, ...scope } = request as Record<string, unknown>;
  return stableSerializeScope(scope);
}

/** 默认假定后端返回 `{ list, total }`，缺失时回退为空列表和 0。 */
function defaultMapQueryData<TData, TQueryData>(
  data: TQueryData | undefined
): PaginatedResponse<TData> {
  const page = data as PaginatedResponse<TData> | undefined;

  return {
    list: page?.list ?? [],
    total: page?.total ?? 0
  };
}

/** 解析 ColumnDef 的稳定 ID，优先 id，其次 accessorKey。 */
function getColumnId<TData>(column: ColumnDef<TData>): string | null {
  if (typeof column.id === 'string' && column.id.length > 0) {
    return column.id;
  }

  if (
    'accessorKey' in column &&
    typeof column.accessorKey === 'string' &&
    column.accessorKey.length > 0
  ) {
    return column.accessorKey;
  }

  return null;
}

/** 开发环境提示 DSL 无法自动序列化的筛选类型，避免筛选 UI 看似生效但请求无条件。 */
function warnUnsupportedDslFilterVariants<TData>({
  tableId,
  columns
}: {
  tableId: string;
  columns: Array<ColumnDef<TData>>;
}) {
  if (!import.meta.env.DEV) {
    return;
  }

  for (const column of columns) {
    if (column.enableColumnFilter === false) {
      continue;
    }

    const variant = column.meta?.variant;
    if (!variant || isDataTableDslFilterVariantSupported(variant)) {
      continue;
    }

    const columnId = getColumnId(column);
    if (!columnId) {
      continue;
    }

    const warningKey = `${tableId}:${columnId}:${variant}`;
    if (warnedUnsupportedFilterVariants.has(warningKey)) {
      continue;
    }

    warnedUnsupportedFilterVariants.add(warningKey);
    console.warn('[useDslDataTable] Unsupported filter variant for automatic DSL serialization.', {
      tableId,
      columnId,
      variant
    });
  }
}

function useMetadataAwareRefetch<TQueryData, TError>({
  query,
  metadataReady,
  refetchMetadata
}: {
  query: UseQueryResult<TQueryData, TError>;
  metadataReady: boolean;
  refetchMetadata: () => Promise<unknown>;
}) {
  const queryResultRef = React.useRef(query);
  queryResultRef.current = query;
  const refetchBusiness = query.refetch;
  return React.useCallback<UseQueryResult<TQueryData, TError>['refetch']>(
    async (options) => {
      if (!metadataReady) {
        // 元数据就绪后再恢复默认方案，业务查询由 enabled 自动继续。
        await refetchMetadata();
        return queryResultRef.current;
      }
      return refetchBusiness(options);
    },
    [metadataReady, refetchMetadata, refetchBusiness]
  );
}

export function useDslDataTable<
  TData,
  TRequest = DataTableDslPageRequestBase,
  TQueryData = PaginatedResponse<TData>,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey
>({
  tableId,
  sceneCode,
  advancedSearchFields,
  columns,
  queryOptions,
  baseCondition,
  defaultRequestSort,
  defaultSort = [],
  mapQueryData,
  refreshBehavior,
  enableZebraStriping = true,
  showSelectColumn,
  showRowNumberColumn,
  initialState,
  ...tableProps
}: UseDslDataTableProps<TData, TRequest, TQueryData, TError, TQueryKey>): UseDslDataTableResult<
  TData,
  TQueryData,
  TError
> {
  // pageSize 有本地偏好，isReady 前不发起 query，避免先用默认值请求再立刻改 pageSize。
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({ tableId });
  const { sceneMetadata, metadataReady, metadataError, advancedFields, refetchMetadata } =
    useQuerySceneMetadata({ sceneCode, columns, advancedSearchFields });
  const [advancedCondition, setAdvancedCondition] = React.useState<DataTableDslCondition>();
  const [schemeHydrated, setSchemeHydrated] = React.useState(!sceneCode);
  const [selectedSchemeId, setSelectedSchemeId] = React.useState<number>();
  const [selectedSchemeSnapshot, setSelectedSchemeSnapshot] = React.useState<string>();
  const tableRef = React.useRef<ReturnType<typeof useDataTable<TData>>['table'] | null>(null);
  const schemeQuery = useQuery({
    ...listQuerySchemesQueryOptions({ sceneCode: sceneCode ?? 'disabled' }),
    enabled: isReady && Boolean(sceneCode)
  });
  const createSchemeMutation = useMutation(createQuerySchemeMutationOptions());
  const updateSchemeMutation = useMutation(updateQuerySchemeMutationOptions());
  const deleteSchemeMutation = useMutation(deleteQuerySchemeMutationOptions());
  const defaultSchemeMutation = useMutation(updateDefaultQuerySchemeMutationOptions());
  const schemes = React.useMemo(() => resolveQuerySchemes(schemeQuery.data), [schemeQuery.data]);
  const advancedRuntimeRef = React.useRef<DataTableAdvancedSearchRuntime>({
    sceneCode: sceneCode ?? '',
    fields: [],
    conditionCount: 0,
    summary: '',
    applyCondition: () => undefined,
    clearAll: () => undefined,
    schemes: [],
    dirty: false,
    loadingSchemes: false,
    mutatingScheme: false,
    applyScheme: () => undefined,
    saveAs: async () => undefined,
    overwriteSelected: async () => undefined,
    renameSelected: async () => undefined,
    deleteSelected: async () => undefined,
    setSelectedAsDefault: async () => undefined
  });
  const [resolvedData, setResolvedData] = React.useState<ResolvedDslData<TData>>({
    list: [],
    total: 0,
    pageNo: 1,
    scopeKey: `${tableId}:initial`
  });

  React.useEffect(() => {
    warnUnsupportedDslFilterVariants({ tableId, columns });
  }, [columns, tableId]);

  const total = resolvedData.total ?? 0;

  const { table, ...tableState } = useDataTableRuntime(
    {
      ...tableProps,
      tableId,
      columns,
      data: resolvedData.list ?? [],
      totalCount: total,
      sortingMode: 'server',
      pageSize,
      onPageSizeChange: setPageSize,
      showSelectColumn: showSelectColumn ?? true,
      showRowNumberColumn: showRowNumberColumn ?? true,
      initialState:
        defaultSort.length > 0
          ? {
              // defaultSort 只在 initialState 没有 sorting 时生效，避免覆盖调用方显式排序。
              ...initialState,
              sorting: initialState?.sorting ?? defaultSort
            }
          : initialState
    },
    {
      editingScope: {
        pageNo: resolvedData.pageNo,
        scopeKey: resolvedData.scopeKey,
        requireExplicitRowId: true
      },
      enableZebraStriping,
      treeScopeKey: JSON.stringify(baseCondition ?? null),
      tableMeta: {
        dataTableAdvancedSearch: sceneCode ? advancedRuntimeRef.current : undefined
      }
    }
  );

  tableRef.current = table;

  const getCurrentSchemeContent = React.useCallback(() => {
    const quickConditions = buildDataTableDslQuickConditions(
      columns,
      tableRef.current?.getState().columnFilters ?? []
    );
    return buildQuerySchemeContent(quickConditions, advancedCondition);
  }, [advancedCondition, columns]);

  const getCurrentSchemeContentJson = React.useCallback(
    () => JSON.stringify(getCurrentSchemeContent()),
    [getCurrentSchemeContent]
  );

  const applyResolvedScheme = React.useCallback(
    (schemeId: number, notifyInvalid = true) => {
      const scheme = schemes.find((item) => item.id === schemeId);
      if (!scheme || !tableRef.current) return false;
      const resolved = parseQuerySchemeContent(
        scheme,
        advancedFields,
        columns as Array<ColumnDef<unknown>>,
        sceneMetadata?.limits
      );
      if (!resolved) {
        if (notifyInvalid) {
          toast.error(`查询方案“${scheme.schemeName}”包含已失效字段或比较符，请编辑或删除`);
        }
        return false;
      }
      tableRef.current.setColumnFilters(resolved.columnFilters);
      tableRef.current.setPageIndex(0);
      setAdvancedCondition(resolved.content.advancedCondition);
      setSelectedSchemeId(scheme.id);
      setSelectedSchemeSnapshot(JSON.stringify(resolved.content));
      return true;
    },
    [advancedFields, columns, schemes, sceneMetadata]
  );

  React.useEffect(() => {
    setSchemeHydrated(!sceneCode);
    setSelectedSchemeId(undefined);
    setSelectedSchemeSnapshot(undefined);
  }, [sceneCode]);

  React.useEffect(() => {
    if (
      !sceneCode ||
      !metadataReady ||
      schemeHydrated ||
      schemeQuery.isPending ||
      !tableRef.current
    )
      return;
    const defaultScheme = schemes.find((scheme) => scheme.defaultScheme);
    if (defaultScheme) applyResolvedScheme(defaultScheme.id);
    setSchemeHydrated(true);
  }, [
    applyResolvedScheme,
    metadataReady,
    sceneCode,
    schemeHydrated,
    schemeQuery.isPending,
    schemes
  ]);

  const applyCondition = React.useCallback(
    (condition?: DataTableDslCondition) => {
      const request = buildDataTableDslRequest({
        columns,
        baseCondition,
        advancedCondition: condition,
        pagination: tableRef.current!.getState().pagination,
        sorting: [],
        columnFilters: tableRef.current!.getState().columnFilters
      });
      const error = validateCombinedCondition(request.condition, sceneMetadata?.limits);
      if (error) {
        toast.error(error);
        return false;
      }
      setAdvancedCondition(condition);
      tableRef.current?.setPageIndex(0);
      return true;
    },
    [columns, baseCondition, sceneMetadata]
  );

  const clearAllConditions = React.useCallback(() => {
    tableRef.current?.resetColumnFilters(true);
    tableRef.current?.setPageIndex(0);
    setAdvancedCondition(undefined);
  }, []);

  const applyScheme = React.useCallback(
    (schemeId?: number) => {
      if (schemeId === undefined) {
        setSelectedSchemeId(undefined);
        setSelectedSchemeSnapshot(undefined);
        clearAllConditions();
        return;
      }
      applyResolvedScheme(schemeId);
    },
    [applyResolvedScheme, clearAllConditions]
  );

  const refreshSchemes = React.useCallback(async () => {
    const result = await schemeQuery.refetch();
    return resolveQuerySchemes(result.data);
  }, [schemeQuery]);

  const saveAs = React.useCallback(
    async (schemeName: string, defaultScheme: boolean) => {
      if (!sceneCode) return;
      const contentJson = getCurrentSchemeContentJson();
      await createSchemeMutation.mutateAsync({
        sceneCode,
        schemeName: schemeName.trim(),
        contentJson,
        defaultScheme
      });
      const refreshed = await refreshSchemes();
      const created = refreshed.find((scheme) => scheme.schemeName === schemeName.trim());
      if (created) {
        setSelectedSchemeId(created.id);
        setSelectedSchemeSnapshot(contentJson);
      }
      toast.success('查询方案已保存');
    },
    [createSchemeMutation, getCurrentSchemeContentJson, refreshSchemes, sceneCode]
  );

  const overwriteSelected = React.useCallback(async () => {
    const selected = schemes.find((scheme) => scheme.id === selectedSchemeId);
    if (!selected) return;
    const contentJson = getCurrentSchemeContentJson();
    await updateSchemeMutation.mutateAsync({
      id: selected.id,
      schemeName: selected.schemeName,
      contentJson,
      version: selected.version
    });
    await refreshSchemes();
    setSelectedSchemeSnapshot(contentJson);
    toast.success('查询方案已覆盖');
  }, [
    getCurrentSchemeContentJson,
    refreshSchemes,
    schemes,
    selectedSchemeId,
    updateSchemeMutation
  ]);

  const renameSelected = React.useCallback(
    async (schemeName: string) => {
      const selected = schemes.find((scheme) => scheme.id === selectedSchemeId);
      if (!selected) return;
      const contentJson = selected.contentJson;
      await updateSchemeMutation.mutateAsync({
        id: selected.id,
        schemeName: schemeName.trim(),
        contentJson,
        version: selected.version
      });
      await refreshSchemes();
      setSelectedSchemeSnapshot(contentJson);
      toast.success('查询方案已更新');
    },
    [refreshSchemes, schemes, selectedSchemeId, updateSchemeMutation]
  );

  const deleteSelected = React.useCallback(async () => {
    const selected = schemes.find((scheme) => scheme.id === selectedSchemeId);
    if (!selected) return;
    await deleteSchemeMutation.mutateAsync({ id: selected.id, version: selected.version });
    await refreshSchemes();
    setSelectedSchemeId(undefined);
    setSelectedSchemeSnapshot(undefined);
    toast.success('查询方案已删除');
  }, [deleteSchemeMutation, refreshSchemes, schemes, selectedSchemeId]);

  const setSelectedAsDefault = React.useCallback(
    async (enabled: boolean) => {
      if (!sceneCode) return;
      await defaultSchemeMutation.mutateAsync({
        sceneCode,
        ...(enabled && selectedSchemeId ? { schemeId: selectedSchemeId } : {})
      });
      await refreshSchemes();
      toast.success(enabled ? '已设为默认方案' : '已取消默认方案');
    },
    [defaultSchemeMutation, refreshSchemes, sceneCode, selectedSchemeId]
  );

  const currentSchemeContentJson = getCurrentSchemeContentJson();
  const hasCurrentConditions =
    advancedCondition !== undefined || table.getState().columnFilters.length > 0;
  Object.assign(advancedRuntimeRef.current, {
    sceneCode: sceneCode ?? '',
    fields: advancedFields,
    limits: sceneMetadata?.limits,
    condition: advancedCondition,
    conditionCount: countAdvancedConditions(advancedCondition),
    summary: summarizeAdvancedCondition(advancedCondition, advancedFields),
    applyCondition,
    clearAll: clearAllConditions,
    schemes,
    selectedSchemeId,
    dirty: selectedSchemeSnapshot
      ? currentSchemeContentJson !== selectedSchemeSnapshot
      : hasCurrentConditions,
    loadingSchemes: !metadataReady || schemeQuery.isPending,
    mutatingScheme:
      createSchemeMutation.isPending ||
      updateSchemeMutation.isPending ||
      deleteSchemeMutation.isPending ||
      defaultSchemeMutation.isPending,
    applyScheme,
    saveAs,
    overwriteSelected,
    renameSelected,
    deleteSelected,
    setSelectedAsDefault
  } satisfies DataTableAdvancedSearchRuntime);

  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  const request = React.useMemo(
    // request 是 queryKey/queryFn 的输入，必须只由可序列化表格状态和列 meta 推导。
    () =>
      buildDataTableDslRequest({
        columns,
        pagination,
        sorting,
        columnFilters,
        baseCondition,
        advancedCondition,
        defaultRequestSort
      }) as TRequest,
    [
      advancedCondition,
      baseCondition,
      columnFilters,
      columns,
      defaultRequestSort,
      pagination,
      sorting
    ]
  );

  const options = React.useMemo(() => queryOptions(request), [queryOptions, request]);
  const currentEditingScopeKey = React.useMemo(() => getDslEditingScopeKey(request), [request]);

  const conditionError = sceneCode
    ? validateCombinedCondition(
        (request as DataTableDslPageRequestBase).condition,
        sceneMetadata?.limits
      )
    : undefined;
  const query = useQuery({
    ...options,
    ...(conditionError
      ? {
          queryFn: async () => {
            throw new Error(conditionError);
          },
          retry: false
        }
      : {}),
    enabled: isReady && metadataReady && schemeHydrated && (options.enabled ?? true),
    placeholderData: options.placeholderData ?? keepPreviousData
  });
  const canRefresh =
    isReady && (schemeHydrated || Boolean(metadataError)) && (options.enabled ?? true);

  const resolvedMapQueryData = React.useMemo(
    // mapQueryData 允许适配非标准后端结构，例如 data.records/data.total。
    () => mapQueryData ?? defaultMapQueryData<TData, TQueryData>,
    [mapQueryData]
  );

  const mappedData = React.useMemo(
    () => resolvedMapQueryData(query.data),
    [query.data, resolvedMapQueryData]
  );

  React.useEffect(() => {
    if (query.data === undefined || query.isPlaceholderData) {
      return;
    }

    // 只有 query 真正有数据时才更新 resolvedData，placeholderData 期间保留上一批表格数据。
    setResolvedData((current) => {
      const pageNo = pagination.pageIndex + 1;
      return current.total === mappedData.total &&
        current.list === mappedData.list &&
        current.pageNo === pageNo &&
        current.scopeKey === currentEditingScopeKey
        ? current
        : {
            ...mappedData,
            pageNo,
            scopeKey: currentEditingScopeKey
          };
    });
  }, [
    currentEditingScopeKey,
    mappedData,
    pagination.pageIndex,
    query.data,
    query.isPlaceholderData
  ]);

  const refetchQuery = useMetadataAwareRefetch({ query, metadataReady, refetchMetadata });

  const queryState = React.useMemo<QueryStateSubset<TQueryData, TError>>(
    () => ({
      data: query.data,
      isFetching: !metadataError && (!isReady || !schemeHydrated || query.isFetching),
      error: (metadataError as TError | null) ?? query.error,
      isError: Boolean(metadataError) || query.isError,
      refetch: refetchQuery
    }),
    [
      isReady,
      metadataError,
      query.data,
      query.error,
      query.isError,
      query.isFetching,
      refetchQuery,
      schemeHydrated
    ]
  );

  const onRefreshSuccess = refreshBehavior?.onSuccess;
  const onRefreshError = refreshBehavior?.onError;
  const handleRefresh = React.useCallback(async () => {
    if (!metadataReady) {
      const result = await refetchMetadata();
      if (result.error) await onRefreshError?.(result.error as TError);
      return;
    }
    const result = await refetchQuery();

    if (result.error) {
      await onRefreshError?.(result.error as TError);
      return;
    }

    await onRefreshSuccess?.();
  }, [metadataReady, refetchMetadata, onRefreshError, onRefreshSuccess, refetchQuery]);

  const refreshProps = React.useMemo<RefreshProps | undefined>(() => {
    if (!canRefresh) {
      return undefined;
    }

    return {
      isRefreshing: !isReady || query.isFetching,
      onRefresh: handleRefresh
    };
  }, [canRefresh, handleRefresh, isReady, query.isFetching]);

  return {
    table,
    ...tableState,
    total: mappedData.total ?? resolvedData.total ?? 0,
    queryState,
    refreshProps
  };
}
