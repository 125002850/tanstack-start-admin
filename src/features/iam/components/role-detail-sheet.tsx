import { FieldItem } from '@/components/ui/detail-field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { RoleRspDTO } from '@/lib/api/clients/service';
import { dataScopeLabel, formatOptionalDateTime } from '../lib/format';

export default function RoleDetailSheet({
  role,
  open,
  onOpenChange
}: {
  role?: RoleRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>角色详情</SheetTitle>
          <SheetDescription>{role?.roleName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='角色ID' value={role?.roleId} />
          <FieldItem label='角色编码' value={role?.roleCode} />
          <FieldItem label='角色名称' value={role?.roleName} />
          <FieldItem label='状态' value={role?.status} />
          <FieldItem label='数据范围' value={dataScopeLabel(role?.dataScopeType)} />
          <FieldItem label='排序' value={role?.sortOrder} />
          <FieldItem label='系统内置' value={role?.systemBuiltIn ? '是' : '否'} />
          <FieldItem label='菜单数量' value={role?.menuIds?.length ?? 0} />
          <FieldItem label='自定义部门数' value={role?.dataScopeDeptIds?.length ?? 0} />
          <FieldItem label='创建时间' value={formatOptionalDateTime(role?.createTime)} />
          <FieldItem label='更新时间' value={formatOptionalDateTime(role?.updateTime)} />
          <FieldItem label='备注' value={role?.remark} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
