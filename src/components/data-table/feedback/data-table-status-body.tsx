import type { ReactNode } from 'react';

import { TableBody, TableCell, TableRow } from '@/components/ui/table';

/** 表体状态按可视区域居中，横向滚动时保持位置。 */
export function DataTableStatusBody({
  colSpan,
  children
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <TableBody data-component='data-table-body'>
      <TableRow>
        <TableCell colSpan={colSpan} className='px-0'>
          <div
            data-slot='data-table-status'
            className='sticky left-0 -ml-px flex w-[min(100%,var(--data-table-status-viewport-width,100%))] flex-col items-center justify-center py-16 text-center'
          >
            {children}
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  );
}
