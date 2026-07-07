import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { useConfirmAction } from '@/hooks/use-confirm-action';

const DATA_TABLE_ROW_ACTION_BUTTON_SIZE = 32;
const DATA_TABLE_ROW_ACTION_GAP = 2;
const DATA_TABLE_ROW_ACTION_CELL_PADDING_X = 32;

export const DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE = 3;

export interface DataTableRowAction<TData> {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean | ((row: TData) => boolean);
  hidden?: boolean | ((row: TData) => boolean);
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

function resolveRowActionValue<TData, TValue>(
  value: TValue | ((row: TData) => TValue),
  row: TData
): TValue {
  return typeof value === 'function' ? (value as (row: TData) => TValue)(row) : value;
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
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const { withConfirm, confirmDialog } = useConfirmAction<[DataTableRowAction<TData>, TData]>();

  // When sheet closes, wait for the CSS exit animation to finish before unmounting.
  // This avoids a hardcoded setTimeout and stays in sync with any animation duration changes.
  React.useEffect(() => {
    if (!sheetOpen && sheetAction) {
      const handleAnimationEnd = (e: AnimationEvent) => {
        const el = e.target as HTMLElement;
        if (el.dataset.state === 'closed') {
          setSheetAction(null);
        }
      };
      document.addEventListener('animationend', handleAnimationEnd);
      return () => document.removeEventListener('animationend', handleAnimationEnd);
    }
  }, [sheetOpen, sheetAction]);

  const handleSheetOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      setSheetOpen(false);
    }
  }, []);

  const handleClick = React.useCallback(
    async (action: DataTableRowAction<TData>) => {
      if (resolveRowActionValue(action.disabled ?? false, row)) {
        return;
      }

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
        setSheetOpen(true);
        return;
      }
      await action.onClick?.(row);
    },
    [row, withConfirm]
  );

  const resolvedActions = React.useMemo(
    () => actions.filter((action) => !resolveRowActionValue(action.hidden ?? false, row)),
    [actions, row]
  );
  const visibleActions = resolvedActions.slice(0, maxVisible);
  const moreActions = resolvedActions.slice(maxVisible);

  return (
    <>
      {confirmDialog}
      {sheetAction?.Sheet && (
        <sheetAction.Sheet data={row} open={sheetOpen} onOpenChange={handleSheetOpenChange} />
      )}
      <TooltipProvider>
        <div className='flex items-center gap-0.5' data-row-expand-ignore>
          {visibleActions.map((action) => (
            <TooltipPrimitive.Root key={action.label}>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  disabled={resolveRowActionValue(action.disabled ?? false, row)}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleClick(action);
                  }}
                  aria-label={action.label}
                  data-row-expand-ignore
                >
                  {action.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </TooltipPrimitive.Root>
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
                    disabled={resolveRowActionValue(action.disabled ?? false, row)}
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
      </TooltipProvider>
    </>
  );
}
