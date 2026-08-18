import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Icons } from '@/components/icons';

export function EmptyBody({ colSpan, message }: { colSpan: number; message: React.ReactNode }) {
  return (
    <TableBody data-component='data-table-body'>
      <TableRow>
        <TableCell colSpan={colSpan}>
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <Icons.search className='text-muted-foreground/30 mb-4 h-12 w-12' />
            <p className='text-muted-foreground text-sm font-medium'>{message}</p>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  );
}
