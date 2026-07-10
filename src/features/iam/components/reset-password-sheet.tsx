import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { StaffRspDTO } from '@/lib/api/clients/service';

import { FieldShell } from './staff-form-sheet';

function ResetPasswordSheet({
  open,
  onOpenChange,
  staff,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
  onSubmit: (newPassword: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = React.useState('');

  React.useEffect(() => {
    if (open) setNewPassword('');
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>重置密码</SheetTitle>
          <SheetDescription>{staff?.staffName ?? staff?.username ?? '当前员工'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1'>
          <FieldShell label='新密码'>
            <Input type='password' value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </FieldShell>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              if (!newPassword.trim()) {
                toast.error('请输入新密码');
                return;
              }
              await onSubmit(newPassword);
              onOpenChange(false);
            }}
          >
            确认重置
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ResetPasswordSheet;
