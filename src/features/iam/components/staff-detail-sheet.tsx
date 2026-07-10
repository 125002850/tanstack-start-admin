import { Badge } from '@/components/ui/badge';
import { FieldItem } from '@/components/ui/detail-field';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { StaffRspDTO } from '@/lib/api/clients/service';

import { formatOptionalDateTime } from '../lib/format';

function StaffDetailSheet({
  open,
  onOpenChange,
  staff
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-2xl flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>员工详情</SheetTitle>
          <SheetDescription>{staff?.staffName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='员工ID' value={staff?.staffId} />
          <FieldItem label='用户名' value={staff?.username} />
          <FieldItem label='工号' value={staff?.staffCode} />
          <FieldItem label='姓名' value={staff?.staffName} />
          <FieldItem label='部门' value={staff?.deptName} />
          <FieldItem label='手机号' value={staff?.phone} />
          <FieldItem label='邮箱' value={staff?.email} />
          <FieldItem label='状态' value={staff?.status} />
          <FieldItem label='必须改密' value={staff?.mustChangePassword ? '是' : '否'} />
          <FieldItem label='创建时间' value={formatOptionalDateTime(staff?.createTime)} />
          <FieldItem label='更新时间' value={formatOptionalDateTime(staff?.updateTime)} />
          <FieldItem label='备注' value={staff?.remark} valueMaxLines={2} />
          <div className='space-y-2 sm:col-span-2'>
            <Label>角色</Label>
            <div className='flex flex-wrap gap-1.5'>
              {(staff?.roles ?? []).length > 0 ? (
                staff!.roles!.map((role) => (
                  <Badge key={role.roleId ?? role.roleCode} variant='outline'>
                    {role.roleName ?? role.roleCode}
                  </Badge>
                ))
              ) : (
                <span className='text-muted-foreground text-sm'>未分配角色</span>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default StaffDetailSheet;
