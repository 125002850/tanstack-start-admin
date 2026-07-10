import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type {
  DeptCreateReqDTO,
  DeptRspDTO,
  DeptUpdateReqDTO
} from '@/lib/api/clients/service';
import { ENABLE_STATUS_OPTIONS } from '../lib/constants';
import { deptSelectOptions } from '../lib/tree';

type DeptFormValues = {
  parentId: string;
  deptCode: string;
  deptName: string;
  sortOrder: string;
  status: 'ENABLED' | 'DISABLED';
  remark: string;
};

const emptyValues: DeptFormValues = {
  parentId: 'ROOT',
  deptCode: '',
  deptName: '',
  sortOrder: '10',
  status: 'ENABLED',
  remark: ''
};

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function DeptFormSheet({
  open,
  onOpenChange,
  dept,
  parent,
  tree,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dept?: DeptRspDTO | null;
  parent?: DeptRspDTO | null;
  tree: readonly DeptRspDTO[];
  onSubmit: (payload: DeptCreateReqDTO | DeptUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!dept?.deptId;
  const [values, setValues] = React.useState<DeptFormValues>(emptyValues);
  const parentOptions = React.useMemo(() => deptSelectOptions(tree), [tree]);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      parentId:
        (isEdit ? dept?.parentId : (parent?.deptId ?? dept?.parentId)) == null
          ? 'ROOT'
          : String(isEdit ? dept?.parentId : (parent?.deptId ?? dept?.parentId)),
      deptCode: dept?.deptCode ?? '',
      deptName: dept?.deptName ?? '',
      sortOrder: String(dept?.sortOrder ?? 10),
      status: dept?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      remark: dept?.remark ?? ''
    });
  }, [dept, isEdit, open, parent]);

  const update = React.useCallback(
    (patch: Partial<DeptFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!values.deptCode.trim() || !values.deptName.trim()) {
        toast.error('请填写部门编码和名称');
        return;
      }
      const sortOrder = Number(values.sortOrder);
      const parentId = values.parentId === 'ROOT' ? undefined : Number(values.parentId);

      if (isEdit) {
        if (!dept?.deptId) return;
        await onSubmit({
          deptId: dept.deptId,
          parentId,
          deptCode: values.deptCode.trim(),
          deptName: values.deptName.trim(),
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
          status: values.status,
          remark: values.remark.trim() || undefined
        });
      } else {
        await onSubmit({
          parentId,
          deptCode: values.deptCode.trim(),
          deptName: values.deptName.trim(),
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
          status: values.status,
          remark: values.remark.trim() || undefined
        });
      }
      onOpenChange(false);
    },
    [dept?.deptId, isEdit, onOpenChange, onSubmit, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑部门' : '新增部门'}</SheetTitle>
          <SheetDescription>{isEdit ? '修改部门信息。' : '创建同级或下级部门。'}</SheetDescription>
        </SheetHeader>
        <form id='dept-form' className='min-h-0 flex-1 space-y-4 overflow-auto' onSubmit={handleSubmit}>
          <FieldShell label='上级部门'>
            <Select value={values.parentId} onValueChange={(parentId) => update({ parentId })}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='根部门' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ROOT'>根部门</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={Number(option.value) === dept?.deptId}
                  >
                    <span style={{ paddingInlineStart: `${option.depth}rem` }}>
                      {option.label.trimStart()}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='部门编码'>
              <Input value={values.deptCode} onChange={(event) => update({ deptCode: event.target.value })} />
            </FieldShell>
            <FieldShell label='部门名称'>
              <Input value={values.deptName} onChange={(event) => update({ deptName: event.target.value })} />
            </FieldShell>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='排序'>
              <Input inputMode='numeric' value={values.sortOrder} onChange={(event) => update({ sortOrder: event.target.value })} />
            </FieldShell>
            <FieldShell label='状态'>
              <Select
                value={values.status}
                onValueChange={(status) => update({ status: status as DeptFormValues['status'] })}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENABLE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          </div>
          <FieldShell label='备注'>
            <Textarea value={values.remark} onChange={(event) => update({ remark: event.target.value })} />
          </FieldShell>
        </form>
        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form='dept-form'>
            {isEdit ? '保存修改' : '创建部门'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
