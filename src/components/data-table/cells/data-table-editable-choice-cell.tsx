import { keepPreviousData, queryOptions, useQueries } from '@tanstack/react-query';
import type { CellContext, Table as TanstackTable } from '@tanstack/react-table';
import * as React from 'react';

import {
  MultipleChoiceCombobox,
  SingleChoiceCombobox,
  type ChoiceComboboxLoadMoreProps,
  type ChoiceComboboxSearchMode
} from '@/components/ui/choice-combobox';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableEditorKeyboardShell } from '@/components/data-table/cells/data-table-editor-keyboard-shell';
import { renderDataTableTextCell } from '@/components/data-table/columns/data-table-column-rendering';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditableChoiceColumnMeta,
  DataTableRemoteOptionPage
} from '@/types/data-table';

import { useRemoteComboboxState } from './use-remote-combobox-state';

type RemoteLabelColumnState = {
  isError: boolean;
  isPending: boolean;
  optionByValue: ReadonlyMap<DataTableChoiceValue, DataTableChoiceOption>;
};

const EMPTY_REMOTE_LABEL_STATE: RemoteLabelColumnState = {
  isError: false,
  isPending: false,
  optionByValue: new Map()
};

const DATA_TABLE_CHOICE_EDITOR_TRIGGER_CLASS_NAME =
  'h-full min-h-10 w-full min-w-0 rounded-[2px] border-2 border-primary bg-background px-[15px] py-0 shadow-none ring-[3px] ring-primary/25 hover:bg-background focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 data-[size=sm]:h-full';

const DataTableRemoteChoiceLabelContext = React.createContext<
  ReadonlyMap<string, RemoteLabelColumnState>
>(new Map());

function isChoiceValue(value: unknown): value is DataTableChoiceValue {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

function getChoiceValues(value: unknown): DataTableChoiceValue[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.filter(isChoiceValue))];
}

function mergeChoiceOptions(
  ...groups: Array<readonly DataTableChoiceOption[] | undefined>
): DataTableChoiceOption[] {
  const optionByValue = new Map<DataTableChoiceValue, DataTableChoiceOption>();
  for (const group of groups) {
    for (const option of group ?? []) {
      if (!optionByValue.has(option.value)) optionByValue.set(option.value, option);
    }
  }
  return [...optionByValue.values()];
}

type RemoteLabelRequest<TData> = {
  columnId: string;
  remoteOptions: NonNullable<DataTableEditableChoiceColumnMeta<TData>['remoteOptions']>;
  values: DataTableChoiceValue[];
};

function getRemoteLabelRequests<TData>(table: TanstackTable<TData>): RemoteLabelRequest<TData>[] {
  const rows = table.getRowModel().rows;
  const requests: RemoteLabelRequest<TData>[] = [];

  for (const column of table.getAllLeafColumns()) {
    const editableChoice = column.columnDef.meta?.editableChoice;
    const remoteOptions = editableChoice?.remoteOptions;
    if (
      editableChoice?.type !== 'remoteSelect' ||
      !remoteOptions ||
      !remoteOptions.resolveOptions
    ) {
      continue;
    }

    const values = [
      ...new Set(rows.flatMap((row) => getChoiceValues(row.original[editableChoice.field])))
    ];
    if (values.length === 0) continue;
    requests.push({
      columnId: column.id,
      remoteOptions,
      values
    });
  }
  return requests;
}

/**
 * 当前页 remoteSelect label 批量解析器。
 *
 * 每列只发一个 resolveOptions 查询，多个 cell 的 value 会先聚合去重，避免 N+1。
 */
export function DataTableRemoteChoiceLabelProvider<TData>({
  table,
  children
}: {
  table: TanstackTable<TData>;
  children: React.ReactNode;
}) {
  const requests = getRemoteLabelRequests(table);
  const tableId = table.options.meta?.dataTableId ?? 'data-table';
  const results = useQueries({
    queries: requests.map((request) =>
      queryOptions({
        queryKey: ['data-table-choice-resolve', tableId, request.columnId, request.values],
        queryFn: ({ signal }) =>
          request.remoteOptions.resolveOptions!({
            values: request.values,
            signal
          }),
        placeholderData: keepPreviousData
      })
    )
  });
  const stateByColumn = React.useMemo(() => {
    const next = new Map<string, RemoteLabelColumnState>();
    requests.forEach((request, index) => {
      const result = results[index];
      const options = result?.data ?? [];
      next.set(request.columnId, {
        isError: result?.isError ?? false,
        isPending: (result?.isPending ?? false) && options.length === 0,
        optionByValue: new Map(options.map((option) => [option.value, option]))
      });
    });
    return next;
  }, [requests, results]);

  return (
    <DataTableRemoteChoiceLabelContext.Provider value={stateByColumn}>
      {children}
    </DataTableRemoteChoiceLabelContext.Provider>
  );
}

export function hasDataTableRemoteChoiceLabelResolvers<TData>(table: TanstackTable<TData>) {
  return table
    .getAllLeafColumns()
    .some(
      (column) =>
        column.columnDef.meta?.editableChoice?.type === 'remoteSelect' &&
        Boolean(column.columnDef.meta.editableChoice.remoteOptions?.resolveOptions)
    );
}

function renderChoiceDisplay<TData>({
  config,
  columnId,
  formattedValue,
  value,
  className,
  remoteState
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  columnId: string;
  formattedValue?: unknown;
  value: unknown;
  className?: string;
  remoteState: RemoteLabelColumnState;
}) {
  if (formattedValue !== undefined && formattedValue !== null) {
    return renderDataTableTextCell(formattedValue, className);
  }

  const values = getChoiceValues(value);
  if (
    config.type === 'remoteSelect' &&
    config.remoteOptions?.resolveOptions &&
    remoteState.isPending &&
    values.some((item) => !remoteState.optionByValue.has(item))
  ) {
    return (
      <Skeleton
        data-column-id={columnId}
        aria-label={`正在解析${config.title}`}
        className='h-4 w-24'
      />
    );
  }

  const staticOptions = new Map(
    (config.valueOptions ?? []).map((option) => [option.value, option])
  );
  const labels = values.map(
    (item) =>
      remoteState.optionByValue.get(item)?.label ?? staticOptions.get(item)?.label ?? String(item)
  );
  return renderDataTableTextCell(labels.length > 0 ? labels.join('、') : '-', className);
}

function resolveChoiceEditorLabel<TData>({
  config,
  value,
  remoteState
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  value: unknown;
  remoteState: RemoteLabelColumnState;
}) {
  const staticOptions = new Map(
    (config.valueOptions ?? []).map((option) => [option.value, option])
  );
  const labels = getChoiceValues(value).map(
    (item) =>
      remoteState.optionByValue.get(item)?.label ?? staticOptions.get(item)?.label ?? String(item)
  );

  return labels.length > 0 ? labels.join(',') : `选择${config.title}`;
}

function ChoiceEditorReadyTrigger<TData>({
  config,
  value,
  remoteState,
  onActivate
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  value: unknown;
  remoteState: RemoteLabelColumnState;
  onActivate: () => void;
}) {
  const label = resolveChoiceEditorLabel({ config, value, remoteState });

  return (
    <div
      data-row-expand-ignore
      data-slot='data-table-choice-editor-ready'
      className='absolute inset-0 min-w-0 bg-background'
    >
      <Button
        data-slot='data-table-choice-editor-ready-trigger'
        type='button'
        variant='outline'
        tabIndex={-1}
        aria-expanded='false'
        aria-haspopup='listbox'
        aria-label={`准备编辑${config.title}`}
        onFocus={onActivate}
        onClick={onActivate}
        className={DATA_TABLE_CHOICE_EDITOR_TRIGGER_CLASS_NAME}
      >
        <span className='min-w-0 flex-1 truncate text-left'>{label}</span>
        <Icons.chevronsUpDown className='size-4 shrink-0 text-muted-foreground' />
      </Button>
    </div>
  );
}

function getChoiceSearchMode(
  type: DataTableEditableChoiceColumnMeta<unknown>['type']
): ChoiceComboboxSearchMode {
  if (type === 'enum') return 'none';
  return type === 'remoteSelect' ? 'remote' : 'local';
}

function SingleChoiceEditor<TData>({
  config,
  options,
  open,
  setOpen,
  isLoading = false,
  isError = false,
  inputValue,
  onInputValueChange,
  loadMore,
  runtime
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  options: DataTableChoiceOption[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading?: boolean;
  isError?: boolean;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  loadMore?: ChoiceComboboxLoadMoreProps;
  runtime: NonNullable<CellContext<TData, unknown>['table']['options']['meta']>['dataTableEditing'];
}) {
  const [internalInputValue, setInternalInputValue] = React.useState('');
  if (!runtime) return null;
  const sessionId = runtime.activeCell?.sessionId;
  if (sessionId === undefined) return null;
  const resolvedInputValue = inputValue ?? internalInputValue;
  const handleInputValueChange = onInputValueChange ?? setInternalInputValue;
  const currentValue = runtime.activeCell?.draftValue;
  const value = isChoiceValue(currentValue) ? currentValue : null;
  const optionsWithSelectedValue = mergeChoiceOptions(
    options,
    value == null ? [] : [{ value, label: String(value) }]
  );

  return (
    <SingleChoiceCombobox
      options={optionsWithSelectedValue}
      value={value}
      open={open}
      inputValue={resolvedInputValue}
      searchMode={getChoiceSearchMode(config.type)}
      triggerLabel={`编辑${config.title}`}
      placeholder={`选择${config.title}`}
      searchPlaceholder={`搜索${config.title}`}
      emptyText='未找到匹配项'
      loadingText='正在加载选项'
      errorText='选项加载失败'
      disabled={false}
      isLoading={isLoading}
      isError={isError}
      allowEmpty={config.allowEmpty}
      loadMore={loadMore}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) runtime.finishEditing(sessionId, 'blur');
      }}
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        runtime.cancelEditing(sessionId);
      }}
      onInputValueChange={handleInputValueChange}
      onValueChange={(nextValue) => {
        runtime.setActiveDraft(sessionId, nextValue);
        runtime.finishEditing(sessionId, 'selection');
      }}
      className={DATA_TABLE_CHOICE_EDITOR_TRIGGER_CLASS_NAME}
    />
  );
}

function MultipleChoiceEditor<TData>({
  config,
  options,
  open,
  setOpen,
  isLoading = false,
  isError = false,
  inputValue,
  onInputValueChange,
  loadMore,
  runtime
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  options: DataTableChoiceOption[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading?: boolean;
  isError?: boolean;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  loadMore?: ChoiceComboboxLoadMoreProps;
  runtime: NonNullable<CellContext<TData, unknown>['table']['options']['meta']>['dataTableEditing'];
}) {
  if (!runtime) return null;
  const sessionId = runtime.activeCell?.sessionId;
  if (sessionId === undefined) return null;
  const values = getChoiceValues(runtime.activeCell?.draftValue);
  const optionsWithSelectedValues = mergeChoiceOptions(
    options,
    values.map((value) => ({ value, label: String(value) }))
  );

  return (
    <MultipleChoiceCombobox
      options={optionsWithSelectedValues}
      value={values}
      open={open}
      inputValue={inputValue}
      searchMode={getChoiceSearchMode(config.type)}
      triggerLabel={`编辑${config.title}`}
      placeholder={`选择${config.title}`}
      searchPlaceholder={`搜索${config.title}`}
      emptyText='未找到匹配项'
      loadingText='正在加载选项'
      errorText='选项加载失败'
      isLoading={isLoading}
      isError={isError}
      allowEmpty={config.allowEmpty}
      maxSelected={config.maxSelected}
      loadMore={loadMore}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) runtime.finishEditing(sessionId, 'blur');
      }}
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        runtime.cancelEditing(sessionId);
      }}
      onInputValueChange={onInputValueChange}
      onValueChange={(nextValues) => runtime.setActiveDraft(sessionId, nextValues)}
      className={DATA_TABLE_CHOICE_EDITOR_TRIGGER_CLASS_NAME}
    />
  );
}

function RemoteChoiceEditor<TData>({
  config,
  columnId,
  tableId,
  remoteLabelState,
  open,
  setOpen,
  runtime
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  columnId: string;
  tableId: string;
  remoteLabelState: RemoteLabelColumnState;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  runtime: NonNullable<CellContext<TData, unknown>['table']['options']['meta']>['dataTableEditing'];
}) {
  const remoteOptions = config.remoteOptions!;
  const buildRequest = React.useCallback(
    (params: { keyword: string; pageNo: number; pageSize: number }) => params,
    []
  );
  const queryOptionsFactory = React.useCallback(
    (request: { keyword: string; pageNo: number; pageSize: number }) =>
      queryOptions({
        queryKey: [
          'data-table-choice-options',
          tableId,
          columnId,
          request.keyword,
          request.pageNo,
          request.pageSize
        ],
        queryFn: ({ signal }) => remoteOptions.loadOptions({ ...request, signal })
      }),
    [columnId, remoteOptions, tableId]
  );
  const remoteState = useRemoteComboboxState<
    DataTableChoiceOption,
    { keyword: string; pageNo: number; pageSize: number },
    DataTableRemoteOptionPage<DataTableChoiceValue>
  >({
    open,
    debounceMs: remoteOptions.debounceMs ?? 250,
    pageSize: remoteOptions.pageSize ?? 20,
    buildRequest,
    queryOptionsFactory,
    getItems: (page) => page.items,
    getTotal: (page, items) => page.total ?? items.length,
    getItemKey: (option) => option.value
  });
  const resolvedOptions = getChoiceValues(runtime?.activeCell?.draftValue).flatMap((value) => {
    const option = remoteLabelState.optionByValue.get(value);
    return option ? [option] : [];
  });
  const options = mergeChoiceOptions(resolvedOptions, remoteState.items);
  const loadMore = {
    visible: remoteState.hasMore,
    disabled: remoteState.isFetching,
    isLoading: remoteState.isFetching,
    label: remoteState.isFetching ? '正在加载更多' : '加载更多',
    onClick: remoteState.loadMore
  };

  return config.selectionMode === 'multiple' ? (
    <MultipleChoiceEditor
      config={config}
      options={options}
      open={open}
      setOpen={setOpen}
      isLoading={remoteState.isFetching}
      isError={remoteState.query.isError}
      inputValue={remoteState.inputValue}
      onInputValueChange={remoteState.setInputValue}
      loadMore={loadMore}
      runtime={runtime}
    />
  ) : (
    <SingleChoiceEditor
      config={config}
      options={options}
      open={open}
      setOpen={setOpen}
      isLoading={remoteState.isFetching}
      isError={remoteState.query.isError}
      inputValue={remoteState.inputValue}
      onInputValueChange={remoteState.setInputValue}
      loadMore={loadMore}
      runtime={runtime}
    />
  );
}

function ActiveChoiceEditor<TData>({
  config,
  columnId,
  tableId,
  remoteState,
  runtime,
  sessionId
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  columnId: string;
  tableId: string;
  remoteState: RemoteLabelColumnState;
  runtime: NonNullable<CellContext<TData, unknown>['table']['options']['meta']>['dataTableEditing'];
  sessionId: number;
}) {
  const [open, setOpen] = React.useState(true);
  if (!runtime) return null;

  let editor: React.ReactNode;
  if (config.type === 'remoteSelect') {
    editor = (
      <RemoteChoiceEditor
        config={config}
        columnId={columnId}
        tableId={tableId}
        remoteLabelState={remoteState}
        open={open}
        setOpen={setOpen}
        runtime={runtime}
      />
    );
  } else if (config.selectionMode === 'multiple') {
    editor = (
      <MultipleChoiceEditor
        config={config}
        options={[...(config.valueOptions ?? [])]}
        open={open}
        setOpen={setOpen}
        runtime={runtime}
      />
    );
  } else {
    editor = (
      <SingleChoiceEditor
        config={config}
        options={[...(config.valueOptions ?? [])]}
        open={open}
        setOpen={setOpen}
        runtime={runtime}
      />
    );
  }

  return (
    <DataTableEditorKeyboardShell
      runtime={runtime}
      sessionId={sessionId}
      profile='choice'
      slot='data-table-choice-editor'
      onAnchorDetach={() => setOpen(false)}
    >
      {editor}
    </DataTableEditorKeyboardShell>
  );
}

export function DataTableEditableChoiceCell<TData, TValue>({
  context,
  formattedValue,
  className
}: {
  context: CellContext<TData, TValue>;
  formattedValue?: unknown;
  className?: string;
}) {
  const config = context.column.columnDef.meta?.editableChoice;
  const runtime = context.table.options.meta?.dataTableEditing;
  const remoteStates = React.useContext(DataTableRemoteChoiceLabelContext);
  if (!config) return null;
  const activeCell = runtime?.activeCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;
  const remoteState = remoteStates.get(context.column.id) ?? EMPTY_REMOTE_LABEL_STATE;
  const value = context.getValue();

  if (!isActive || !runtime) {
    return (
      <>
        <div data-slot='data-table-choice-display'>
          {renderChoiceDisplay({
            config,
            columnId: context.column.id,
            formattedValue,
            value,
            className,
            remoteState
          })}
        </div>
        {runtime ? (
          <ChoiceEditorReadyTrigger
            config={config}
            value={value}
            remoteState={remoteState}
            onActivate={() => {
              runtime.startEditing({
                rowId: context.row.id,
                row: context.row.original,
                columnId: context.column.id,
                field: config.field,
                initialValue: value,
                editableCell: config
              });
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <ActiveChoiceEditor
      config={config}
      columnId={context.column.id}
      tableId={context.table.options.meta?.dataTableId ?? 'data-table'}
      remoteState={remoteState}
      runtime={runtime}
      sessionId={activeCell.sessionId}
    />
  );
}
