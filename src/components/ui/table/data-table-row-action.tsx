import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import * as React from 'react';

export interface DataTableRowAction<TData> {
  label: string;
  icon: React.ReactNode;
  onClick?: (row: TData) => void | Promise<void>;
  confirmDelete?: {
    title?: string;
    description?: (row: TData) => string;
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

export function DataTableRowActions<TData>({
  row,
  actions,
  maxVisible = 2
}: DataTableRowActionsProps<TData>) {
  const [deleteAction, setDeleteAction] = React.useState<DataTableRowAction<TData> | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sheetAction, setSheetAction] = React.useState<DataTableRowAction<TData> | null>(null);

  const handleClick = React.useCallback(
    async (action: DataTableRowAction<TData>) => {
      if (action.confirmDelete) {
        setDeleteAction(action);
        return;
      }
      if (action.Sheet) {
        setSheetAction(action);
        return;
      }
      await action.onClick?.(row);
    },
    [row]
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteAction?.onClick) return;
    setIsDeleting(true);
    try {
      await deleteAction.onClick(row);
    } finally {
      setIsDeleting(false);
      setDeleteAction(null);
    }
  }, [deleteAction, row]);

  const visibleActions = actions.slice(0, maxVisible);
  const moreActions = actions.slice(maxVisible);

  return (
    <>
      {deleteAction?.confirmDelete && (
        <AlertModal
          isOpen={!!deleteAction}
          onClose={() => setDeleteAction(null)}
          onConfirm={handleDeleteConfirm}
          loading={isDeleting}
          title={deleteAction.confirmDelete.title ?? '确认删除'}
          description={deleteAction.confirmDelete.description?.(row) ?? '此操作不可撤销。'}
        />
      )}
      {sheetAction?.Sheet && (
        <sheetAction.Sheet
          data={row}
          open={!!sheetAction}
          onOpenChange={(open) => {
            if (!open) setSheetAction(null);
          }}
        />
      )}
      <div className='flex items-center gap-0.5'>
        {visibleActions.map((action) => (
          <Button
            key={action.label}
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={() => handleClick(action)}
            aria-label={action.label}
          >
            {action.icon}
          </Button>
        ))}
        {moreActions.length > 0 && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0' aria-label='更多操作'>
                <Icons.ellipsis className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {moreActions.map((action) => (
                <DropdownMenuItem key={action.label} onClick={() => handleClick(action)}>
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
