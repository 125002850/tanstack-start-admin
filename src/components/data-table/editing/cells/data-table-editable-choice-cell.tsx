import type { CellContext } from '@tanstack/react-table';

import {
  DataTableChoiceDisplay,
  DataTableChoiceReadyTrigger
} from '@/components/data-table/editing/choice/display';
import { DataTableActiveChoiceEditor } from '@/components/data-table/editing/choice/editors';
import { useDataTableRemoteChoiceLabelState } from '@/components/data-table/editing/choice/label-provider';

/** choice cell 门面：只负责 display、edit-ready 与 editing 三态路由。 */
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
  const remoteState = useDataTableRemoteChoiceLabelState(context.column.id);
  if (!config) return null;

  const activeCell = runtime?.activeCell;
  const readyCell = runtime?.readyCell;
  const isActive =
    activeCell?.rowId === context.row.id && activeCell.columnId === context.column.id;
  const isReady = readyCell?.rowId === context.row.id && readyCell.columnId === context.column.id;
  const value = context.getValue();

  if (!isActive || !runtime || !activeCell) {
    return (
      <>
        <div data-slot='display'>
          <DataTableChoiceDisplay
            config={config}
            columnId={context.column.id}
            formattedValue={formattedValue}
            value={value}
            className={className}
            remoteState={remoteState}
          />
        </div>
        {runtime && isReady ? (
          <DataTableChoiceReadyTrigger
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
    <DataTableActiveChoiceEditor
      config={config}
      columnId={context.column.id}
      tableId={context.table.options.meta?.dataTableId ?? 'data-table'}
      remoteState={remoteState}
      runtime={runtime}
      sessionId={activeCell.sessionId}
      draftValue={activeCell.draftValue}
    />
  );
}
