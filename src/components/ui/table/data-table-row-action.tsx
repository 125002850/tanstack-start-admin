import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import * as React from 'react';
import { useConfirmAction } from '@/hooks/use-confirm-action';

const DATA_TABLE_ROW_ACTION_BUTTON_SIZE = 32;
const DATA_TABLE_ROW_ACTION_GAP = 2;
const DATA_TABLE_ROW_ACTION_CELL_PADDING_X = 16;

export const DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE = 2;

export interface DataTableRowAction<TData> {
  label: string;
  icon: React.ReactNode;
  onClick?: (row: TData) => void | Promise<void>;
  confirmDelete?: {
    title?: string;
    description?: (row: TData) => string;
    confirmText?: string;
    cancelText?: string;
  };
  Sheet?: React.ComponentType<{
    data: TData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>;
}

interface DataTableRowActionsProps<TData> {
  row: TData;
  actions: DataTableRowAction<TData>[];
  maxVisible?: number;
}

export function getDataTableRowActionsColumnWidth(
  actionCount: number,
  maxVisible = DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
): number {
  if (actionCount <= 0) {
    return DATA_TABLE_ROW_ACTION_CELL_PADDING_X;
  }

  const displayedActionCount =
    actionCount > maxVisible ? maxVisible + 1 : Math.min(actionCount, maxVisible);

  const gapWidth = Math.max(0, displayedActionCount - 1) * DATA_TABLE_ROW_ACTION_GAP;

  return (
    DATA_TABLE_ROW_ACTION_CELL_PADDING_X +
    displayedActionCount * DATA_TABLE_ROW_ACTION_BUTTON_SIZE +
    gapWidth
  );
}

export function DataTableRowActions<TData>({
  row,
  actions,
  maxVisible = DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
}: DataTableRowActionsProps<TData>) {
  const [sheetAction, setSheetAction] = React.useState<DataTableRowAction<TData> | null>(null);
  const { withConfirm, confirmDialog } = useConfirmAction<[DataTableRowAction<TData>, TData]>();

  const handleClick = React.useCallback(
    async (action: DataTableRowAction<TData>) => {
      if (action.confirmDelete) {
        withConfirm({
          title: (currentAction) => currentAction.confirmDelete?.title ?? '确认删除',
          description: (currentAction, currentRow) =>
            currentAction.confirmDelete?.description?.(currentRow) ?? '此操作不可撤销。',
          confirmText: (currentAction) => currentAction.confirmDelete?.confirmText ?? '删除',
          cancelText: (currentAction) => currentAction.confirmDelete?.cancelText ?? '取消',
          run: async (currentAction, currentRow) => {
            await currentAction.onClick?.(currentRow);
          }
        })(action, row);
        return;
      }
      if (action.Sheet) {
        setSheetAction(action);
        return;
      }
      await action.onClick?.(row);
    },
    [row, withConfirm]
  );

  const visibleActions = actions.slice(0, maxVisible);
  const moreActions = actions.slice(maxVisible);

  return (
    <>
      {confirmDialog}
      {sheetAction?.Sheet && (
        <sheetAction.Sheet
          data={row}
          open={!!sheetAction}
          onOpenChange={(open) => {
            if (!open) setSheetAction(null);
          }}
        />
      )}
      <div className='flex items-center gap-0.5' data-row-expand-ignore>
        {visibleActions.map((action) => (
          <Button
            key={action.label}
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={(event) => {
              event.stopPropagation();
              void handleClick(action);
            }}
            aria-label={action.label}
            data-row-expand-ignore
          >
            {action.icon}
          </Button>
        ))}
        {moreActions.length > 0 && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                className='h-8 w-8 p-0'
                aria-label='更多操作'
                data-row-expand-ignore
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <Icons.ellipsis className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {moreActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  data-row-expand-ignore
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleClick(action);
                  }}
                >
                  {action.icon}
                  <span className='ml-2'>{action.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}
