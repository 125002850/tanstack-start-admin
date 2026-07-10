import type { DeptRspDTO } from '@/lib/api/clients/service';
import { FieldItem } from '@/components/ui/detail-field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { formatOptionalDateTime } from '../lib/format';

export default function DeptDetailSheet({
  dept,
  open,
  onOpenChange
}: {
  dept?: DeptRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>部门详情</SheetTitle>
          <SheetDescription>{dept?.deptName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='部门ID' value={dept?.deptId} />
          <FieldItem label='上级ID' value={dept?.parentId ?? '根部门'} />
          <FieldItem label='部门编码' value={dept?.deptCode} />
          <FieldItem label='部门名称' value={dept?.deptName} />
          <FieldItem label='完整路径' value={dept?.fullPath} valueMaxLines={2} />
          <FieldItem label='排序' value={dept?.sortOrder} />
          <FieldItem label='状态' value={dept?.status} />
          <FieldItem label='创建时间' value={formatOptionalDateTime(dept?.createTime)} />
          <FieldItem label='更新时间' value={formatOptionalDateTime(dept?.updateTime)} />
          <FieldItem label='备注' value={dept?.remark} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
