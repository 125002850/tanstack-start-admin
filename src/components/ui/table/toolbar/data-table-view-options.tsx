import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column, Table } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDataTableColumnLabel } from '@/lib/data-table-column-label';
import { moveDataTableColumnOrder } from '@/lib/data-table-state-persistence';
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface DataTableViewOptionsLabels {
  toggleColumnsAriaLabel?: string;
  buttonText?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  resetOrderText?: string;
}

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  labels?: DataTableViewOptionsLabels;
  iconOnly?: boolean;
  className?: string;
}

interface DataTableViewOptionItemProps<TData> {
  column: Column<TData>;
  table: Table<TData>;
  draggable?: boolean;
  isColumnOrderDragSuppressed?: () => boolean;
}

const COLUMN_ORDER_MOUSE_DISTANCE_PX = 4;
const COLUMN_ORDER_TOUCH_DELAY_MS = 150;
const COLUMN_ORDER_TOUCH_TOLERANCE_PX = 8;

function toggleColumnVisibility<TData>(column: Column<TData>) {
  column.toggleVisibility(!column.getIsVisible());
}

function isColumnPanelVisible<TData>(column: Column<TData>) {
  return column.getCanHide() && column.columnDef.meta?.columnPanelVisible !== false;
}

function canReorderInColumnPanel<TData>(column: Column<TData>) {
  return isColumnPanelVisible(column) && column.columnDef.meta?.columnPanelReorder !== false;
}

function useColumnVisibilityToggle<TData>(
  column: Column<TData>,
  isColumnOrderDragSuppressed?: () => boolean
) {
  const ignoreNextSelectRef = React.useRef(false);
  const ignoreNextSelectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (ignoreNextSelectTimerRef.current) {
        clearTimeout(ignoreNextSelectTimerRef.current);
      }
    };
  }, []);

  const clearIgnoredSelect = React.useCallback(() => {
    if (ignoreNextSelectTimerRef.current) {
      clearTimeout(ignoreNextSelectTimerRef.current);
    }

    ignoreNextSelectTimerRef.current = null;
    ignoreNextSelectRef.current = false;
  }, []);

  const toggleVisibility = React.useCallback(() => {
    toggleColumnVisibility(column);
  }, [column]);

  const handlePointerUpCapture = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isColumnOrderDragSuppressed?.()) {
        event.preventDefault();
        event.stopPropagation();
        ignoreNextSelectRef.current = true;
        ignoreNextSelectTimerRef.current = setTimeout(() => {
          clearIgnoredSelect();
        }, 0);
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-slot="data-table-view-option-drag-handle"]')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      ignoreNextSelectRef.current = true;
      toggleVisibility();

      ignoreNextSelectTimerRef.current = setTimeout(() => {
        clearIgnoredSelect();
      }, 0);
    },
    [clearIgnoredSelect, isColumnOrderDragSuppressed, toggleVisibility]
  );

  const handleSelect = React.useCallback(() => {
    if (isColumnOrderDragSuppressed?.()) {
      clearIgnoredSelect();
      return;
    }

    if (ignoreNextSelectRef.current) {
      clearIgnoredSelect();
      return;
    }

    toggleVisibility();
  }, [clearIgnoredSelect, isColumnOrderDragSuppressed, toggleVisibility]);

  return { handlePointerUpCapture, handleSelect };
}

function DataTableViewOptionItem<TData>({
  column,
  table,
  draggable = false,
  isColumnOrderDragSuppressed
}: DataTableViewOptionItemProps<TData>) {
  const label = getDataTableColumnLabel(column, table);

  if (draggable) {
    return (
      <SortableDataTableViewOptionItem
        column={column}
        table={table}
        label={label}
        isColumnOrderDragSuppressed={isColumnOrderDragSuppressed}
      />
    );
  }

  return (
    <StaticDataTableViewOptionItem
      column={column}
      table={table}
      label={label}
      isColumnOrderDragSuppressed={isColumnOrderDragSuppressed}
    />
  );
}

function StaticDataTableViewOptionItem<TData>({
  column,
  label,
  isColumnOrderDragSuppressed
}: DataTableViewOptionItemProps<TData> & { label: string }) {
  const { handlePointerUpCapture, handleSelect } = useColumnVisibilityToggle(
    column,
    isColumnOrderDragSuppressed
  );

  return (
    <CommandItem onPointerUpCapture={handlePointerUpCapture} onSelect={handleSelect}>
      <span aria-hidden='true' className='size-5 shrink-0' />
      <span className='truncate'>{label}</span>
      <Icons.check
        className={cn(
          'ml-auto size-4 shrink-0',
          column.getIsVisible() ? 'opacity-100' : 'opacity-0'
        )}
      />
    </CommandItem>
  );
}

function SortableDataTableViewOptionItem<TData>({
  column,
  label,
  isColumnOrderDragSuppressed
}: DataTableViewOptionItemProps<TData> & { label: string }) {
  const { handlePointerUpCapture, handleSelect } = useColumnVisibilityToggle(
    column,
    isColumnOrderDragSuppressed
  );
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id });

  const style = React.useMemo<React.CSSProperties>(
    () => ({
      opacity: isDragging ? 0.6 : undefined,
      transform: CSS.Transform.toString(transform),
      transition
    }),
    [isDragging, transform, transition]
  );

  return (
    <div ref={setNodeRef} style={style}>
      <CommandItem
        className='group/view-option'
        onPointerUpCapture={handlePointerUpCapture}
        onSelect={handleSelect}
      >
        <button
          ref={setActivatorNodeRef}
          type='button'
          aria-label={`拖拽调整 ${label} 列顺序`}
          data-slot='data-table-view-option-drag-handle'
          className='text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-5 shrink-0 cursor-grab items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/view-option:opacity-100 group-focus-within/view-option:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:outline-none active:cursor-grabbing'
          {...attributes}
          {...listeners}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Icons.gripVertical />
        </button>
        <span className='truncate'>{label}</span>
        <Icons.check
          className={cn(
            'ml-auto size-4 shrink-0',
            column.getIsVisible() ? 'opacity-100' : 'opacity-0'
          )}
        />
      </CommandItem>
    </div>
  );
}

export function DataTableViewOptions<TData>({
  table,
  labels,
  iconOnly = false,
  className
}: DataTableViewOptionsProps<TData>) {
  const columnDragSuppressedRef = React.useRef(false);
  const columnDragSuppressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const columns = [
    ...table.getLeftLeafColumns(),
    ...table.getCenterLeafColumns(),
    ...table.getRightLeafColumns()
  ].filter((column) => typeof column.accessorFn !== 'undefined' && isColumnPanelVisible(column));
  const draggableColumnIds = table
    .getCenterLeafColumns()
    .filter((column) => typeof column.accessorFn !== 'undefined' && canReorderInColumnPanel(column))
    .map((column) => column.id);
  const sortableColumnIds = draggableColumnIds.length > 1 ? draggableColumnIds : [];
  const sortableColumnIdSet = new Set(sortableColumnIds);
  const columnOrderSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: COLUMN_ORDER_MOUSE_DISTANCE_PX
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: COLUMN_ORDER_TOUCH_DELAY_MS,
        tolerance: COLUMN_ORDER_TOUCH_TOLERANCE_PX
      }
    })
  );
  React.useEffect(() => {
    return () => {
      if (columnDragSuppressTimerRef.current) {
        clearTimeout(columnDragSuppressTimerRef.current);
      }
    };
  }, []);
  const isColumnOrderDragSuppressed = React.useCallback(() => columnDragSuppressedRef.current, []);
  const clearColumnOrderDragSuppressed = React.useCallback(() => {
    if (columnDragSuppressTimerRef.current) {
      clearTimeout(columnDragSuppressTimerRef.current);
    }

    columnDragSuppressTimerRef.current = setTimeout(() => {
      columnDragSuppressedRef.current = false;
      columnDragSuppressTimerRef.current = null;
    }, 0);
  }, []);
  const handleColumnDragStart = (event: DragStartEvent) => {
    if (sortableColumnIdSet.has(String(event.active.id))) {
      columnDragSuppressedRef.current = true;
    }
  };
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    clearColumnOrderDragSuppressed();

    if (
      !overId ||
      activeId === overId ||
      !sortableColumnIdSet.has(activeId) ||
      !sortableColumnIdSet.has(overId)
    ) {
      return;
    }

    table.setColumnOrder(
      moveDataTableColumnOrder(
        table.getAllLeafColumns().map((column) => column.id),
        activeId,
        overId
      )
    );
  };
  const handleColumnDragCancel = () => {
    clearColumnOrderDragSuppressed();
  };
  const columnOrderMeta = table.options.meta?.dataTableColumnOrder;

  if (columns.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={labels?.toggleColumnsAriaLabel ?? '切换表格列显示'}
          variant='outline'
          size='sm'
          className={cn('h-8 shrink-0', iconOnly ? 'w-8 p-0' : 'gap-2 px-3', className)}
        >
          <Icons.adjustments />
          {!iconOnly && (
            <>
              {labels?.buttonText ?? '显示列'}
              <Icons.chevronsUpDown className='ml-auto size-4 opacity-50' />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-48 p-0'>
        <Command>
          <CommandInput placeholder={labels?.searchPlaceholder ?? '搜索列...'} />
          <CommandList className='max-h-none overflow-visible'>
            <CommandEmpty>{labels?.emptyMessage ?? '未找到可显示的列'}</CommandEmpty>
            <CommandGroup className='max-h-64 overflow-y-auto'>
              <DndContext
                sensors={columnOrderSensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={handleColumnDragStart}
                onDragEnd={handleColumnDragEnd}
                onDragCancel={handleColumnDragCancel}
              >
                <SortableContext items={sortableColumnIds} strategy={verticalListSortingStrategy}>
                  {columns.map((column) => (
                    <DataTableViewOptionItem
                      key={column.id}
                      column={column}
                      table={table}
                      draggable={sortableColumnIdSet.has(column.id)}
                      isColumnOrderDragSuppressed={isColumnOrderDragSuppressed}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </CommandGroup>
            {columnOrderMeta ? (
              <>
                <CommandSeparator className='my-1' />
                <CommandGroup>
                  <CommandItem
                    value='data-table-reset-column-order'
                    disabled={!columnOrderMeta.hasCustomOrder}
                    onSelect={() => columnOrderMeta.reset()}
                  >
                    <Icons.rotateClockwise />
                    <span>{labels?.resetOrderText ?? '重置顺序'}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
