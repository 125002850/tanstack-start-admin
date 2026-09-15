import { DataTableStatusBody } from '@/components/data-table/feedback/data-table-status-body';
import { Icons } from '@/components/icons';

export function EmptyBody({ colSpan, message }: { colSpan: number; message: React.ReactNode }) {
  return (
    <DataTableStatusBody colSpan={colSpan}>
      <Icons.search className='text-muted-foreground/30 mb-4 h-12 w-12' />
      <p className='text-muted-foreground text-sm font-medium'>{message}</p>
    </DataTableStatusBody>
  );
}
