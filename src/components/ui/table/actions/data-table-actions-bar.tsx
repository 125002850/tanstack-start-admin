import type { Table } from '@tanstack/react-table';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { getSelectedPageRows } from '@/lib/data-table';
import { cn } from '@/lib/utils';

/**
 * 表格顶部/底部批量操作栏。
 *
 * action 支持静态配置，也支持基于当前 table 与选中行的动态 disabled/hidden/className；
 * 有 children 的 action 渲染为下拉菜单，没有 children 的 action 渲染为普通按钮。
 */

/** 每个操作回调收到的上下文，selectedRows 默认只代表当前已加载页。 */
export interface DataTableActionContext<TData> {
  table: Table<TData>;
  selectedRows: TData[];
}

export interface DataTableAction<TData> {
  label: string;
  icon?: React.ReactNode;
  type?: 'default' | 'danger';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean | ((ctx: DataTableActionContext<TData>) => boolean);
  hidden?: boolean | ((ctx: DataTableActionContext<TData>) => boolean);
  className?: string | ((ctx: DataTableActionContext<TData>) => string);
  callback?: (ctx: DataTableActionContext<TData>) => void | Promise<void>;
  children?: DataTableAction<TData>[];
}

export interface DataTableActionsBarProps<TData> {
  table: Table<TData>;
  actions: DataTableAction<TData>[];
  className?: string;
  getSelectedRows?: () => TData[];
}

/** 统一解析静态值和基于上下文的函数值。 */
function resolveValue<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: T | ((ctx: DataTableActionContext<any>) => T),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: DataTableActionContext<any>
): T {
  return typeof value === 'function'
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (value as (ctx: DataTableActionContext<any>) => T)(ctx)
    : value;
}

/** danger 类型默认映射为 destructive，普通 action 默认使用 outline。 */
function getActionButtonVariant<TData>(
  action: DataTableAction<TData>
): 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' {
  if (action.type === 'danger') {
    return 'destructive';
  }

  return action.variant ?? 'outline';
}

/** DropdownMenuItem 只支持 default/destructive，所以这里收敛 Button variant。 */
function getActionMenuItemVariant<TData>(
  action: DataTableAction<TData>
): 'default' | 'destructive' {
  if (action.type === 'danger' || action.variant === 'destructive') {
    return 'destructive';
  }

  return 'default';
}

/** 父级 action 如果所有子项都隐藏，则整个入口也不渲染。 */
function hasVisibleChildren<TData>(
  action: DataTableAction<TData>,
  ctx: DataTableActionContext<TData>
): boolean {
  if (!action.children || action.children.length === 0) {
    return true;
  }

  return action.children.some((child) => !resolveValue(child.hidden ?? false, ctx));
}

/** outline 按钮之间不加分隔符，混入强调按钮时用分隔符提高识别度。 */
function shouldRenderActionSeparator<TData>(
  previousAction: DataTableAction<TData>,
  currentAction: DataTableAction<TData>
): boolean {
  return (
    getActionButtonVariant(previousAction) !== 'outline' ||
    getActionButtonVariant(currentAction) !== 'outline'
  );
}

export function DataTableActionsBar<TData>({
  table,
  actions,
  className,
  getSelectedRows
}: DataTableActionsBarProps<TData>) {
  // 允许调用方传 getSelectedRows，以便和外部选择模型保持一致。
  const ctx: DataTableActionContext<TData> = {
    table,
    selectedRows: getSelectedRows ? getSelectedRows() : getSelectedPageRows(table)
  };

  const visibleActions = actions.filter(
    (action) => !resolveValue(action.hidden ?? false, ctx) && hasVisibleChildren(action, ctx)
  );

  if (visibleActions.length === 0) return null;

  return (
    <div className={cn('flex items-center', className)}>
      <ButtonGroup aria-label='表格操作'>
        {visibleActions.map((action, index) => (
          <React.Fragment key={action.label}>
            {index > 0 && shouldRenderActionSeparator(visibleActions[index - 1]!, action) && (
              <ButtonGroupSeparator />
            )}
            <ActionItem action={action} ctx={ctx} />
          </React.Fragment>
        ))}
      </ButtonGroup>
    </div>
  );
}

/** 单个顶层 action；异步 callback 会自动进入 loading，并阻止重复点击。 */
function ActionItem<TData>({
  action,
  ctx
}: {
  action: DataTableAction<TData>;
  ctx: DataTableActionContext<TData>;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const disabled = isLoading || resolveValue(action.disabled ?? false, ctx);
  const className = resolveValue(action.className ?? '', ctx);

  const handleClick = React.useCallback(async () => {
    if (!action.callback || isLoading) return;
    const result = action.callback(ctx);
    if (result instanceof Promise) {
      setIsLoading(true);
      try {
        await result;
      } finally {
        setIsLoading(false);
      }
    }
  }, [action, isLoading, ctx]);

  // 有 children 的 action 作为下拉入口，子项自己处理 loading 和 disabled。
  if (action.children && action.children.length > 0) {
    const visibleChildren = action.children.filter(
      (child) => !resolveValue(child.hidden ?? false, ctx)
    );

    if (visibleChildren.length === 0) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={getActionButtonVariant(action)}
            size='sm'
            disabled={disabled}
            className={cn('gap-1.5', className)}
          >
            {action.icon}
            {action.label}
            <Icons.chevronDown className='size-3.5 opacity-50' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='min-w-[160px]'>
          {action.label && (
            <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
              {action.label}
            </DropdownMenuLabel>
          )}
          {visibleChildren.map((child, i) => (
            <DropdownActionItem
              key={child.label}
              action={child}
              ctx={ctx}
              showSeparator={i > 0 && child.label !== visibleChildren[i - 1]?.label}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // 无 children 的 action 作为普通按钮。
  return (
    <Button
      variant={getActionButtonVariant(action)}
      size='sm'
      disabled={disabled}
      isLoading={isLoading}
      onClick={handleClick}
      className={cn('gap-1.5', className)}
    >
      {action.icon}
      {action.label}
    </Button>
  );
}

/** 下拉菜单 action：onSelect 中 preventDefault，避免菜单在异步任务前自动关闭造成反馈丢失。 */
function DropdownActionItem<TData>({
  action,
  ctx,
  showSeparator
}: {
  action: DataTableAction<TData>;
  ctx: DataTableActionContext<TData>;
  showSeparator: boolean;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const disabled = isLoading || resolveValue(action.disabled ?? false, ctx);
  const hidden = resolveValue(action.hidden ?? false, ctx);
  const className = resolveValue(action.className ?? '', ctx);

  const handleSelect = React.useCallback(
    async (e: Event) => {
      e.preventDefault();
      if (!action.callback || isLoading) return;
      const result = action.callback(ctx);
      if (result instanceof Promise) {
        setIsLoading(true);
        try {
          await result;
        } finally {
          setIsLoading(false);
        }
      }
    },
    [action, isLoading, ctx]
  );

  if (hidden) return null;

  return (
    <>
      {showSeparator && <DropdownMenuSeparator />}
      <DropdownMenuItem
        disabled={disabled}
        onSelect={handleSelect}
        variant={getActionMenuItemVariant(action)}
        className={cn('gap-1.5', className)}
      >
        {isLoading ? <Icons.spinner className='size-3.5 animate-spin' /> : action.icon}
        {action.label}
      </DropdownMenuItem>
    </>
  );
}
