import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
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
  const newPasswordId = React.useId();

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
        <form
          className='flex min-h-0 flex-1 flex-col gap-4'
          onSubmit={async (event) => {
            event.preventDefault();
            if (!newPassword.trim()) {
              toast.error('请输入新密码');
              return;
            }
            await onSubmit(newPassword);
            onOpenChange(false);
          }}
        >
          <div className='min-h-0 flex-1'>
            <Field>
              <FieldLabel htmlFor={newPasswordId}>新密码</FieldLabel>
              <Input
                id={newPasswordId}
                name='newPassword'
                type='password'
                value={newPassword}
                autoComplete='new-password'
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>
          </div>
          <SheetFooter className='flex-row justify-end'>
            <Button type='submit'>确认重置</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default ResetPasswordSheet;
