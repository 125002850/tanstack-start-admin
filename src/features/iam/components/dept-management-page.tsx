import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { PermissionGate } from '@/components/permission-gate';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldItem } from '@/components/ui/detail-field';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  iamDeptCreate,
  iamDeptDelete,
  iamDeptStatusUpdate,
  iamDeptUpdate,
  type DeptCreateReqDTO,
  type DeptRspDTO,
  type DeptUpdateReqDTO
} from '@/lib/api/clients/service';
import { iamDeptTreeQueryOptions } from '../api/query-options';
import { ENABLE_STATUS_OPTIONS, IAM_PERMISSIONS } from '../lib/constants';
import { formatOptionalDateTime, nextStatus, StatusBadge } from '../lib/format';
import { deptSelectOptions, flattenDeptTree } from '../lib/tree';

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

function invalidateDeptTree(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    queryKey: ['service', 'iam-dept'],
    exact: false
  });
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DeptFormSheet({
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
                  <SelectItem key={option.value} value={option.value} disabled={Number(option.value) === dept?.deptId}>
                    {option.label}
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
              <Select value={values.status} onValueChange={(status) => update({ status: status as DeptFormValues['status'] })}>
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

function DeptDetailSheet({
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

export default function DeptManagementPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingDept, setEditingDept] = React.useState<DeptRspDTO | null>(null);
  const [parentDept, setParentDept] = React.useState<DeptRspDTO | null>(null);
  const [detailDept, setDetailDept] = React.useState<DeptRspDTO | null>(null);
  const query = useQuery(iamDeptTreeQueryOptions({ keyword: keyword.trim() || undefined }));
  const rows = React.useMemo(() => flattenDeptTree(query.data ?? []), [query.data]);
  const { withConfirm, confirmDialog } = useConfirmAction<[DeptRspDTO]>();

  const createMutation = useMutation({
    mutationFn: (request: DeptCreateReqDTO) => iamDeptCreate(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门已创建');
    }
  });
  const updateMutation = useMutation({
    mutationFn: (request: DeptUpdateReqDTO) => iamDeptUpdate(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门已更新');
    }
  });
  const statusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamDeptStatusUpdate>[0]) => iamDeptStatusUpdate(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门状态已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamDeptDelete>[0]) => iamDeptDelete(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门已删除');
    }
  });
  const confirmDeptStatus = React.useMemo(
    () =>
      withConfirm({
        title: () => '确认切换部门状态',
        description: (dept) =>
          `确认将 ${dept.deptName ?? '该部门'} ${dept.status === 'ENABLED' ? '停用' : '启用'}？`,
        confirmText: '确认',
        cancelText: '取消',
        run: async (dept) => {
          if (!dept.deptId) return;
          await statusMutation.mutateAsync({
            deptId: dept.deptId,
            status: nextStatus(dept.status)
          });
        }
      }),
    [statusMutation, withConfirm]
  );
  const confirmDeptDelete = React.useMemo(
    () =>
      withConfirm({
        title: () => '确认删除部门',
        description: (dept) => `删除后 ${dept.deptName ?? '该部门'} 不可恢复。`,
        confirmText: '确认删除',
        cancelText: '取消',
        run: async (dept) => {
          if (!dept.deptId) return;
          await deleteMutation.mutateAsync({ deptId: dept.deptId });
        }
      }),
    [deleteMutation, withConfirm]
  );

  return (
    <>
      <Card>
        <CardContent className='space-y-4 px-0'>
          <div className='flex flex-wrap items-center gap-2 px-6'>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder='搜索部门编码或名称'
              className='h-8 w-56'
            />
            <Button variant='outline' size='sm' onClick={() => query.refetch()}>
              <Icons.rotateClockwise className='size-4' />
              刷新
            </Button>
            <PermissionGate permission={IAM_PERMISSIONS.dept.manage}>
              <Button
                size='sm'
                onClick={() => {
                  setEditingDept(null);
                  setParentDept(null);
                  setFormOpen(true);
                }}
              >
                <Icons.add className='size-4' />
                新增部门
              </Button>
            </PermissionGate>
          </div>
          <div className='overflow-auto px-6 pb-6'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>部门名称</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className='text-right'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((dept) => (
                  <TableRow key={dept.deptId}>
                    <TableCell>
                      <Button
                        variant='link'
                        className='h-auto p-0 font-medium'
                        style={{ marginLeft: dept.depth * 18 }}
                        onClick={() => setDetailDept(dept)}
                      >
                        {dept.deptName}
                      </Button>
                    </TableCell>
                    <TableCell>{dept.deptCode}</TableCell>
                    <TableCell>{dept.sortOrder ?? '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={dept.status} />
                    </TableCell>
                    <TableCell>{formatOptionalDateTime(dept.createTime)}</TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        <PermissionGate permission={IAM_PERMISSIONS.dept.manage}>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='新增下级'
                            onClick={() => {
                              setEditingDept(null);
                              setParentDept(dept);
                              setFormOpen(true);
                            }}
                          >
                            <Icons.plusCircle className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='编辑'
                            onClick={() => {
                              setEditingDept(dept);
                              setParentDept(null);
                              setFormOpen(true);
                            }}
                          >
                            <Icons.edit className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='切换状态'
                            onClick={() => confirmDeptStatus(dept)}
                          >
                            <Icons.rotate className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='删除'
                            onClick={() => confirmDeptDelete(dept)}
                          >
                            <Icons.trash className='size-4' />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className='h-24 text-center text-muted-foreground'>
                      {query.isFetching ? '加载中' : '暂无部门'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
      <DeptFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        dept={editingDept}
        parent={parentDept}
        tree={query.data ?? []}
        onSubmit={async (payload) => {
          if ('deptId' in payload) {
            await updateMutation.mutateAsync(payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
      />
      <DeptDetailSheet
        open={!!detailDept}
        onOpenChange={(open) => !open && setDetailDept(null)}
        dept={detailDept}
      />
    </>
  );
}
