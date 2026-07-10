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
import type { RoleRspDTO } from '@/lib/api/clients/service';
import { menuMultiSelectOptions } from '../lib/tree';

import { FieldShell } from './role-form-sheet';

export default function RoleMenusSheet({
  open,
  onOpenChange,
  role,
  options,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  options: ReturnType<typeof menuMultiSelectOptions>;
  onSubmit: (menuIds: number[]) => Promise<void>;
}) {
  const [menuIds, setMenuIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setMenuIds((role?.menuIds ?? []).map(String));
  }, [open, role?.menuIds]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>菜单权限</SheetTitle>
          <SheetDescription>{role?.roleName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1'>
          <FieldShell label='菜单与按钮权限'>
            <MultiSelectCombobox
              triggerLabel='菜单权限'
              placeholder='选择菜单或按钮'
              options={options}
              value={menuIds}
              onValueChange={setMenuIds}
            />
          </FieldShell>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              await onSubmit(menuIds.map(Number).filter(Number.isFinite));
              onOpenChange(false);
            }}
          >
            保存权限
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
