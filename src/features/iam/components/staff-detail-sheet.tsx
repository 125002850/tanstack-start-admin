import { Badge } from '@/components/ui/badge';
import { DetailProfileCard } from '@/components/ui/detail/detail-profile-card';
import { DetailSection } from '@/components/ui/detail/detail-section';
import { FieldItem } from '@/components/ui/detail-field';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { StaffRspDTO } from '@/lib/api/clients/service';

import { formatOptionalDateTime } from '../lib/format';

function statusBadge(status?: string) {
  if (status === 'ENABLED') {
    return (
      <Badge className='bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-400 dark:hover:bg-emerald-400/15'>
        启用
      </Badge>
    );
  }
  if (status === 'DISABLED') {
    return (
      <Badge
        variant='destructive'
        className='bg-red-600/10 text-red-600 hover:bg-red-600/15 dark:bg-red-400/10 dark:text-red-400 dark:hover:bg-red-400/15'
      >
        禁用
      </Badge>
    );
  }
  return <Badge variant='outline'>{status ?? '-'}</Badge>;
}

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
      <SheetContent className='flex max-w-2xl flex-col gap-0 sm:max-w-2xl'>
        <SheetHeader className='px-0 pt-6'>
          <SheetTitle>员工详情</SheetTitle>
        </SheetHeader>
        <div className='flex min-h-0 flex-1 flex-col overflow-auto'>
          <DetailProfileCard
            name={staff?.staffName ?? '-'}
            subtitle={staff?.deptName}
            status={statusBadge(staff?.status)}
          />

          <div className='flex flex-col gap-6 px-6 pb-6'>
            <DetailSection title='基本信息'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <FieldItem label='员工ID' value={staff?.staffId} />
                <FieldItem label='用户名' value={staff?.username} />
                <FieldItem label='工号' value={staff?.staffCode} />
                <FieldItem label='姓名' value={staff?.staffName} />
                <FieldItem label='手机号' value={staff?.phone} />
                <FieldItem label='邮箱' value={staff?.email} />
              </div>
            </DetailSection>

            <DetailSection title='账户与权限'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <FieldItem label='必须改密' value={staff?.mustChangePassword ? '是' : '否'} />
                <div className='space-y-2'>
                  <span className='text-muted-foreground block text-xs font-medium uppercase tracking-wider'>
                    角色
                  </span>
                  <div className='flex flex-wrap gap-1.5'>
                    {(staff?.roles ?? []).length > 0 ? (
                      staff!.roles!.map((role) => (
                        <Badge
                          key={role.roleId ?? role.roleCode}
                          variant='secondary'
                          className='text-xs font-normal'
                        >
                          {role.roleName ?? role.roleCode}
                        </Badge>
                      ))
                    ) : (
                      <span className='text-muted-foreground text-sm'>未分配角色</span>
                    )}
                  </div>
                </div>
              </div>
            </DetailSection>

            <DetailSection title='时间记录'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <FieldItem label='创建时间' value={formatOptionalDateTime(staff?.createTime)} />
                <FieldItem label='更新时间' value={formatOptionalDateTime(staff?.updateTime)} />
              </div>
              <div className='mt-3'>
                <FieldItem label='备注' value={staff?.remark} valueMaxLines={2} />
              </div>
            </DetailSection>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default StaffDetailSheet;
