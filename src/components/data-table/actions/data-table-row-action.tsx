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
import { DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE } from '@/lib/data-table/row-actions';
import type { DataTableRowAction } from './types';

/**
 * 行级操作渲染组件。
 *
 * 前 N 个 action 直接展示为图标按钮，超出的 action 收进“更多”菜单；每个 action 可以
 * 根据当前行动态 disabled/hidden，也可以走删除确认或打开 Sheet 表单。
 */
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

export function DataTableRowActions<TData>({
  row,
  actions,
  maxVisible = DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
}: DataTableRowActionsProps<TData>) {
  const [sheetAction, setSheetAction] = React.useState<DataTableRowAction<TData> | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const { withConfirm, confirmDialog } = useConfirmAction<[DataTableRowAction<TData>, TData]>();

  // Sheet 关闭后等待 CSS 退出动画结束再卸载，避免硬编码 setTimeout 并保持动画时长同步。
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
        // 删除确认由 useConfirmAction 统一渲染；实际删除逻辑仍来自 action.onClick。
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
        // 有 Sheet 的 action 不立即执行 onClick，而是把当前 action 作为待渲染表单。
        setSheetAction(action);
        setSheetOpen(true);
        return;
      }
      await action.onClick?.(row);
    },
    [row, withConfirm]
  );

  const resolvedActions = React.useMemo(
    // hidden 支持按行动态判断，因此必须在每次 row/actions 变化时重新过滤。
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
            <TooltipPrimitive.Root key={action.id ?? action.label}>
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
                    key={action.id ?? action.label}
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
