import * as React from 'react';

import { DataTableEditorKeyboardShell } from '@/components/data-table/editing/cells/data-table-editor-keyboard-shell';
import {
  MultipleChoiceCombobox,
  SingleChoiceCombobox,
  type ChoiceComboboxLoadMoreProps,
  type ChoiceComboboxSearchMode
} from '@/components/ui/choice-combobox';
import type {
  DataTableChoiceOption,
  DataTableEditableChoiceColumnMeta,
  DataTableEditingRuntime
} from '../types';

import {
  getDataTableChoiceValues,
  isDataTableChoiceValue,
  mergeDataTableChoiceOptions
} from './model';
import { DATA_TABLE_CHOICE_EDITOR_TRIGGER_CLASS_NAME } from './display';
import type { DataTableRemoteChoiceLabelState } from './label-provider';
import { useDataTableRemoteChoiceOptions } from './use-options';

function getChoiceSearchMode(
  type: DataTableEditableChoiceColumnMeta<unknown>['type']
): ChoiceComboboxSearchMode {
  if (type === 'enum') return 'none';
  return type === 'remoteSelect' ? 'remote' : 'local';
}

type ChoiceEditorProps<TData> = {
  config: DataTableEditableChoiceColumnMeta<TData>;
  options: DataTableChoiceOption[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading?: boolean;
  isError?: boolean;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  loadMore?: ChoiceComboboxLoadMoreProps;
  runtime: DataTableEditingRuntime<TData>;
  sessionId: number;
  draftValue: unknown;
};

/** 单选在有效选择后立即提交。 */
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
  runtime,
  sessionId,
  draftValue
}: ChoiceEditorProps<TData>) {
  const [internalInputValue, setInternalInputValue] = React.useState('');
  const resolvedInputValue = inputValue ?? internalInputValue;
  const handleInputValueChange = onInputValueChange ?? setInternalInputValue;
  const value = isDataTableChoiceValue(draftValue) ? draftValue : null;
  const optionsWithSelectedValue = mergeDataTableChoiceOptions(
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

/** 多选只更新 table 级 active draft，由 blur/Tab 等会话动作统一提交。 */
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
  runtime,
  sessionId,
  draftValue
}: ChoiceEditorProps<TData>) {
  const values = getDataTableChoiceValues(draftValue);
  const optionsWithSelectedValues = mergeDataTableChoiceOptions(
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
  runtime,
  sessionId,
  draftValue
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  columnId: string;
  tableId: string;
  remoteLabelState: DataTableRemoteChoiceLabelState;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  runtime: DataTableEditingRuntime<TData>;
  sessionId: number;
  draftValue: unknown;
}) {
  const remoteOptions = useDataTableRemoteChoiceOptions({
    config,
    columnId,
    tableId,
    remoteLabelState,
    open,
    value: draftValue
  });
  const editorProps = {
    config,
    options: remoteOptions.options,
    open,
    setOpen,
    isLoading: remoteOptions.isLoading,
    isError: remoteOptions.isError,
    inputValue: remoteOptions.inputValue,
    onInputValueChange: remoteOptions.setInputValue,
    loadMore: remoteOptions.loadMore,
    runtime,
    sessionId,
    draftValue
  };

  return config.selectionMode === 'multiple' ? (
    <MultipleChoiceEditor {...editorProps} />
  ) : (
    <SingleChoiceEditor {...editorProps} />
  );
}

export function DataTableActiveChoiceEditor<TData>({
  config,
  columnId,
  tableId,
  remoteState,
  runtime,
  sessionId,
  draftValue
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  columnId: string;
  tableId: string;
  remoteState: DataTableRemoteChoiceLabelState;
  runtime: DataTableEditingRuntime<TData>;
  sessionId: number;
  draftValue: unknown;
}) {
  const [open, setOpen] = React.useState(true);

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
        sessionId={sessionId}
        draftValue={draftValue}
      />
    );
  } else {
    const editorProps = {
      config,
      options: [...(config.valueOptions ?? [])],
      open,
      setOpen,
      runtime,
      sessionId,
      draftValue
    };
    editor =
      config.selectionMode === 'multiple' ? (
        <MultipleChoiceEditor {...editorProps} />
      ) : (
        <SingleChoiceEditor {...editorProps} />
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
