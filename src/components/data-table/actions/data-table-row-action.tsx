import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { DataTableActionTooltip } from './data-table-action-tooltip';
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

function RowActionButton<TData>({
  action,
  label,
  disabled,
  reason,
  onAction
}: {
  action: DataTableRowAction<TData>;
  label: string;
  disabled: boolean;
  reason: string | null | undefined;
  onAction: (action: DataTableRowAction<TData>) => Promise<void>;
}) {
  return (
    <DataTableActionTooltip label={label} disabled={disabled} reason={reason}>
      <Button
        variant='ghost'
        size='icon'
        className='h-8 w-8'
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          void onAction(action);
        }}
        aria-label={label}
        data-row-expand-ignore
      >
        {action.icon}
      </Button>
    </DataTableActionTooltip>
  );
}

// 只缓存按钮展示，动态显隐/禁用仍在父组件解析；行数据和回调变化会更新 onAction。
const MemoizedRowActionButton = React.memo(RowActionButton) as typeof RowActionButton;

export function DataTableRowActions<TData>({
  row,
  actions,
  maxVisible = DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
}: DataTableRowActionsProps<TData>) {
  const [sheetAction, setSheetAction] = React.useState<DataTableRowAction<TData> | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const pendingRef = React.useRef(new Set<string>());
  const [pendingKeys, setPendingKeys] = React.useState<ReadonlySet<string>>(new Set());
  const runAction = React.useCallback(
    async (action: DataTableRowAction<TData>, currentRow: TData) => {
      const key = action.id ?? action.label;
      if (
        pendingRef.current.has(key) ||
        resolveRowActionValue(action.disabled ?? false, currentRow)
      )
        return;
      pendingRef.current.add(key);
      let asynchronous = false;
      try {
        const result = action.onClick?.(currentRow);
        if (result instanceof Promise) {
          asynchronous = true;
          setPendingKeys(new Set(pendingRef.current));
          await result;
        }
      } finally {
        pendingRef.current.delete(key);
        if (asynchronous) setPendingKeys(new Set(pendingRef.current));
      }
    },
    []
  );

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
      if (
        pendingRef.current.has(action.id ?? action.label) ||
        resolveRowActionValue(action.disabled ?? false, row)
      ) {
        return;
      }

      if (action.confirm || action.confirmDelete) {
        // 删除确认由 useConfirmAction 统一渲染；实际删除逻辑仍来自 action.onClick。
        withConfirm({
          title: (currentAction, currentRow) =>
            currentAction.confirm
              ? resolveRowActionValue(currentAction.confirm.title ?? '确认操作', currentRow)
              : (currentAction.confirmDelete?.title ?? '确认删除'),
          description: (currentAction, currentRow) =>
            currentAction.confirm
              ? resolveRowActionValue(
                  currentAction.confirm.description ?? '请确认是否继续。',
                  currentRow
                )
              : (currentAction.confirmDelete?.description?.(currentRow) ?? '此操作不可撤销。'),
          confirmText: (currentAction) =>
            currentAction.confirm
              ? (currentAction.confirm.confirmText ?? '确认')
              : (currentAction.confirmDelete?.confirmText ?? '删除'),
          cancelText: (currentAction) =>
            currentAction.confirm?.cancelText ?? currentAction.confirmDelete?.cancelText ?? '取消',
          run: async (currentAction, currentRow) => {
            await runAction(currentAction, currentRow);
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
      await runAction(action, row);
    },
    [row, withConfirm, runAction]
  );

  // 闭包中的权限/状态也会变化，每次解析显隐；仅缓存最终按钮展示。
  const resolvedActions = actions.filter(
    (action) => !resolveRowActionValue(action.hidden ?? false, row)
  );
  const visibleActions = resolvedActions.slice(0, maxVisible);
  const moreActions = resolvedActions.slice(maxVisible);

  return (
    <>
      {confirmDialog}
      {sheetAction?.Sheet && (
        <sheetAction.Sheet data={row} open={sheetOpen} onOpenChange={handleSheetOpenChange} />
      )}

      <div className='flex items-center gap-0.5' data-row-expand-ignore>
        {visibleActions.map((action) => {
          const pending = pendingKeys.has(action.id ?? action.label);
          const disabled = pending || resolveRowActionValue(action.disabled ?? false, row);
          return (
            <MemoizedRowActionButton
              key={action.id ?? action.label}
              action={action}
              label={action.getLabel?.(row) ?? action.label}
              disabled={disabled}
              reason={
                pending
                  ? '正在处理，请稍候。'
                  : disabled
                    ? resolveRowActionValue(action.disabledReason ?? '', row)
                    : undefined
              }
              onAction={handleClick}
            />
          );
        })}
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
                  aria-disabled={
                    pendingKeys.has(action.id ?? action.label) ||
                    resolveRowActionValue(action.disabled ?? false, row)
                  }
                  className='aria-disabled:opacity-50 aria-disabled:cursor-not-allowed'
                  onClick={(event) => event.stopPropagation()}
                  onSelect={(event) => {
                    if (
                      pendingRef.current.has(action.id ?? action.label) ||
                      resolveRowActionValue(action.disabled ?? false, row)
                    ) {
                      event.preventDefault();
                      return;
                    }
                    void handleClick(action);
                  }}
                >
                  {action.icon}
                  <span className='ml-2'>
                    <span className='block'>{action.getLabel?.(row) ?? action.label}</span>
                    {pendingKeys.has(action.id ?? action.label) ||
                    resolveRowActionValue(action.disabled ?? false, row) ? (
                      <span className='block text-xs'>
                        {(pendingKeys.has(action.id ?? action.label)
                          ? '正在处理，请稍候。'
                          : resolveRowActionValue(action.disabledReason ?? '', row)) ||
                          '当前条件不满足，暂不可操作。'}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}
