import { renderDataTableTextCell } from '@/components/data-table/cells/data-table-text-cell';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditableChoiceColumnMeta
} from '../types';

import { getDataTableChoiceValues, resolveDataTableChoiceLabels } from './model';
import type { DataTableRemoteChoiceLabelState } from './label-provider';

export const DATA_TABLE_CHOICE_EDITOR_TRIGGER_CLASS_NAME =
  'h-full min-h-10 w-full min-w-0 rounded-[2px] border-2 border-primary bg-background px-[15px] py-0 shadow-none ring-[3px] ring-primary/25 hover:bg-background focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 data-[size=sm]:h-full';

function createStaticOptionMap<TData>(config: DataTableEditableChoiceColumnMeta<TData>) {
  return new Map<DataTableChoiceValue, DataTableChoiceOption>(
    (config.valueOptions ?? []).map((option) => [option.value, option])
  );
}

export function DataTableChoiceDisplay<TData>({
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
  remoteState: DataTableRemoteChoiceLabelState;
}) {
  if (formattedValue !== undefined && formattedValue !== null) {
    return renderDataTableTextCell(formattedValue, className);
  }

  const values = getDataTableChoiceValues(value);
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

  const labels = resolveDataTableChoiceLabels(
    value,
    remoteState.optionByValue,
    createStaticOptionMap(config)
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
  remoteState: DataTableRemoteChoiceLabelState;
}) {
  const labels = resolveDataTableChoiceLabels(
    value,
    remoteState.optionByValue,
    createStaticOptionMap(config)
  );
  return labels.length > 0 ? labels.join(',') : `选择${config.title}`;
}

export function DataTableChoiceReadyTrigger<TData>({
  config,
  value,
  remoteState,
  onActivate
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  value: unknown;
  remoteState: DataTableRemoteChoiceLabelState;
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
