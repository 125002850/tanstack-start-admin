import type { Table } from '@tanstack/react-table';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────

export interface DataTableActionContext<TData> {
  table: Table<TData>;
  selectedRows: TData[];
}

export interface DataTableAction<TData> {
  label: string;
  icon?: React.ReactNode;
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

// ── Component ────────────────────────────────────────────────────────

export function DataTableActionsBar<TData>({
  table,
  actions,
  className
}: DataTableActionsBarProps<TData>) {
  const ctx: DataTableActionContext<TData> = {
    table,
    selectedRows: table.getFilteredSelectedRowModel().rows.map((r) => r.original)
  };

  const hasVisibleActions = actions.some((a) => !resolveValue(a.hidden ?? false, ctx));

  if (!hasVisibleActions) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2',
        'bg-card/50 backdrop-blur-sm',
        'transition-all duration-300',
        className
      )}
    >
      {actions.map((action) => (
        <ActionItem key={action.label} action={action} ctx={ctx} />
      ))}
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
  const hidden = resolveValue(action.hidden ?? false, ctx);
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

    if (visibleChildren.length === 0 && hidden) return null;

    return (
      <div
        className={cn(
          'shrink-0 transition-all duration-300 ease-out',
          hidden
            ? 'pointer-events-none max-w-0 overflow-hidden opacity-0'
            : 'max-w-[400px] opacity-100'
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={action.variant ?? 'outline'}
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
      </div>
    );
  }

  // Regular button
  return (
    <div
      className={cn(
        'shrink-0 transition-all duration-300 ease-out',
        hidden
          ? 'pointer-events-none max-w-0 overflow-hidden opacity-0'
          : 'max-w-[400px] opacity-100'
      )}
    >
      <Button
        variant={action.variant ?? 'outline'}
        size='sm'
        disabled={disabled}
        isLoading={isLoading}
        onClick={handleClick}
        className={cn('gap-1.5', className)}
      >
        {action.icon}
        {action.label}
      </Button>
    </div>
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
        className={cn('gap-1.5', className)}
      >
        {isLoading ? <Icons.spinner className='size-3.5 animate-spin' /> : action.icon}
        {action.label}
      </DropdownMenuItem>
    </>
  );
}
