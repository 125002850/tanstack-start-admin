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

// ── Types ────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────

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

function getActionButtonVariant<TData>(
  action: DataTableAction<TData>
): 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' {
  if (action.type === 'danger') {
    return 'destructive';
  }

  return action.variant ?? 'outline';
}

function getActionMenuItemVariant<TData>(action: DataTableAction<TData>): 'default' | 'destructive' {
  if (action.type === 'danger' || action.variant === 'destructive') {
    return 'destructive';
  }

  return 'default';
}

function hasVisibleChildren<TData>(
  action: DataTableAction<TData>,
  ctx: DataTableActionContext<TData>
): boolean {
  if (!action.children || action.children.length === 0) {
    return true;
  }

  return action.children.some((child) => !resolveValue(child.hidden ?? false, ctx));
}

function shouldRenderActionSeparator<TData>(
  previousAction: DataTableAction<TData>,
  currentAction: DataTableAction<TData>
): boolean {
  return (
    getActionButtonVariant(previousAction) !== 'outline' ||
    getActionButtonVariant(currentAction) !== 'outline'
  );
}

// ── Component ────────────────────────────────────────────────────────

export function DataTableActionsBar<TData>({
  table,
  actions,
  className,
  getSelectedRows
}: DataTableActionsBarProps<TData>) {
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
            {index > 0 &&
              shouldRenderActionSeparator(visibleActions[index - 1]!, action) && (
                <ButtonGroupSeparator />
              )}
            <ActionItem action={action} ctx={ctx} />
          </React.Fragment>
        ))}
      </ButtonGroup>
    </div>
  );
}

// ── Action Item ──────────────────────────────────────────────────────

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

  // Dropdown: has children
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

  // Regular button
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

// ── Dropdown Action Item ─────────────────────────────────────────────

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
