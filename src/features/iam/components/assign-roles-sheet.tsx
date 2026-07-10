import * as React from 'react';

import { Button } from '@/components/ui/button';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { StaffRspDTO } from '@/lib/api/clients/service';

import { FieldShell, roleOptions, selectedRoleIds } from './staff-form-sheet';

function AssignRolesSheet({
  open,
  onOpenChange,
  staff,
  roles,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
  roles: ReturnType<typeof roleOptions>;
  onSubmit: (roleIds: number[]) => Promise<void>;
}) {
  const [roleIds, setRoleIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setRoleIds(selectedRoleIds(staff));
  }, [open, staff]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>分配角色</SheetTitle>
          <SheetDescription>{staff?.staffName ?? staff?.username ?? '当前员工'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1'>
          <FieldShell label='角色'>
            <MultiSelectCombobox
              triggerLabel='角色'
              placeholder='选择角色'
              options={roles}
              value={roleIds}
              onValueChange={setRoleIds}
            />
          </FieldShell>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              await onSubmit(roleIds.map(Number).filter(Number.isFinite));
              onOpenChange(false);
            }}
          >
            保存角色
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AssignRolesSheet;
