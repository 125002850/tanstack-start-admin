import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { PermissionGate } from '@/components/permission-gate';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  iamMenuCreate,
  iamMenuDelete,
  iamMenuStatusUpdate,
  iamMenuUpdate,
  type MenuCreateReqDTO,
  type MenuRspDTO,
  type MenuUpdateReqDTO
} from '@/lib/api/clients/service';
import { iamMenuTreeQueryOptions } from '../api/query-options';
import { ENABLE_STATUS_OPTIONS, IAM_PERMISSIONS, MENU_TYPE_OPTIONS } from '../lib/constants';
import { formatOptionalDateTime, MenuTypeBadge, nextStatus, StatusBadge } from '../lib/format';
import { flattenMenuTree, menuSelectOptions } from '../lib/tree';

type MenuFormValues = {
  parentId: string;
  menuCode: string;
  menuName: string;
  menuType: 'DIR' | 'MENU' | 'BUTTON';
  routePath: string;
  componentPath: string;
  icon: string;
  sortOrder: string;
  hidden: boolean;
  cached: boolean;
  status: 'ENABLED' | 'DISABLED';
  permissionCode: string;
  remark: string;
};

const emptyValues: MenuFormValues = {
  parentId: 'ROOT',
  menuCode: '',
  menuName: '',
  menuType: 'MENU',
  routePath: '',
  componentPath: '',
  icon: '',
  sortOrder: '10',
  hidden: false,
  cached: false,
  status: 'ENABLED',
  permissionCode: '',
  remark: ''
};

function invalidateMenuTree(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['service', 'iam-menu'], exact: false }),
    queryClient.invalidateQueries({ queryKey: ['iam', 'me'], exact: false })
  ]);
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MenuFormSheet({
  open,
  onOpenChange,
  menu,
  parent,
  tree,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu?: MenuRspDTO | null;
  parent?: MenuRspDTO | null;
  tree: readonly MenuRspDTO[];
  onSubmit: (payload: MenuCreateReqDTO | MenuUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!menu?.menuId;
  const [values, setValues] = React.useState<MenuFormValues>(emptyValues);
  const parentOptions = React.useMemo(() => menuSelectOptions(tree, menu?.menuId), [menu?.menuId, tree]);

  React.useEffect(() => {
    if (!open) return;
    const parentId = isEdit ? menu?.parentId : (parent?.menuId ?? menu?.parentId);
    setValues({
      parentId: parentId == null ? 'ROOT' : String(parentId),
      menuCode: menu?.menuCode ?? '',
      menuName: menu?.menuName ?? '',
      menuType:
        menu?.menuType === 'DIR' || menu?.menuType === 'BUTTON' || menu?.menuType === 'MENU'
          ? menu.menuType
          : 'MENU',
      routePath: menu?.routePath ?? '',
      componentPath: menu?.componentPath ?? '',
      icon: menu?.icon ?? '',
      sortOrder: String(menu?.sortOrder ?? 10),
      hidden: menu?.hidden ?? false,
      cached: menu?.cached ?? false,
      status: menu?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      permissionCode: menu?.permissionCode ?? '',
      remark: menu?.remark ?? ''
    });
  }, [isEdit, menu, open, parent]);

  const update = React.useCallback(
    (patch: Partial<MenuFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!values.menuCode.trim() || !values.menuName.trim()) {
        toast.error('请填写菜单编码和名称');
        return;
      }
      if (values.menuType === 'BUTTON' && !values.permissionCode.trim()) {
        toast.error('按钮权限必须填写权限标识');
        return;
      }
      const sortOrder = Number(values.sortOrder);
      const payload = {
        parentId: values.parentId === 'ROOT' ? undefined : Number(values.parentId),
        menuCode: values.menuCode.trim(),
        menuName: values.menuName.trim(),
        menuType: values.menuType,
        routePath: values.routePath.trim() || undefined,
        componentPath: values.componentPath.trim() || undefined,
        icon: values.icon.trim() || undefined,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        hidden: values.hidden,
        cached: values.cached,
        status: values.status,
        permissionCode: values.permissionCode.trim() || undefined,
        remark: values.remark.trim() || undefined
      };
      if (isEdit) {
        if (!menu?.menuId) return;
        await onSubmit({ ...payload, menuId: menu.menuId });
      } else {
        await onSubmit(payload);
      }
      onOpenChange(false);
    },
    [isEdit, menu?.menuId, onOpenChange, onSubmit, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑菜单' : '新增菜单'}</SheetTitle>
          <SheetDescription>维护目录、页面菜单和按钮权限节点。</SheetDescription>
        </SheetHeader>
        <form id='menu-form' className='min-h-0 flex-1 space-y-4 overflow-auto' onSubmit={handleSubmit}>
          <FieldShell label='上级菜单'>
            <Select value={values.parentId} onValueChange={(parentId) => update({ parentId })}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='根菜单' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ROOT'>根菜单</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='菜单编码'>
              <Input value={values.menuCode} onChange={(event) => update({ menuCode: event.target.value })} />
            </FieldShell>
            <FieldShell label='菜单名称'>
              <Input value={values.menuName} onChange={(event) => update({ menuName: event.target.value })} />
            </FieldShell>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='类型'>
              <Select value={values.menuType} onValueChange={(menuType) => update({ menuType: menuType as MenuFormValues['menuType'] })}>
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MENU_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
            <FieldShell label='状态'>
              <Select value={values.status} onValueChange={(status) => update({ status: status as MenuFormValues['status'] })}>
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
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='路由路径'>
              <Input value={values.routePath} onChange={(event) => update({ routePath: event.target.value })} />
            </FieldShell>
            <FieldShell label='组件路径'>
              <Input value={values.componentPath} onChange={(event) => update({ componentPath: event.target.value })} />
            </FieldShell>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='权限标识'>
              <Input value={values.permissionCode} onChange={(event) => update({ permissionCode: event.target.value })} />
            </FieldShell>
            <FieldShell label='图标'>
              <Input value={values.icon} onChange={(event) => update({ icon: event.target.value })} />
            </FieldShell>
          </div>
          <FieldShell label='排序'>
            <Input inputMode='numeric' value={values.sortOrder} onChange={(event) => update({ sortOrder: event.target.value })} />
          </FieldShell>
          <div className='flex flex-wrap gap-6'>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='iam-menu-hidden'
                checked={values.hidden}
                onCheckedChange={(checked) => update({ hidden: checked === true })}
              />
              <Label htmlFor='iam-menu-hidden' className='text-sm'>
                隐藏
              </Label>
            </div>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='iam-menu-cached'
                checked={values.cached}
                onCheckedChange={(checked) => update({ cached: checked === true })}
              />
              <Label htmlFor='iam-menu-cached' className='text-sm'>
                缓存
              </Label>
            </div>
          </div>
          <FieldShell label='备注'>
            <Textarea value={values.remark} onChange={(event) => update({ remark: event.target.value })} />
          </FieldShell>
        </form>
        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form='menu-form'>
            {isEdit ? '保存修改' : '创建菜单'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MenuDetailSheet({
  menu,
  open,
  onOpenChange
}: {
  menu?: MenuRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>菜单详情</SheetTitle>
          <SheetDescription>{menu?.menuName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='菜单ID' value={menu?.menuId} />
          <FieldItem label='上级ID' value={menu?.parentId ?? '根菜单'} />
          <FieldItem label='编码' value={menu?.menuCode} />
          <FieldItem label='名称' value={menu?.menuName} />
          <FieldItem label='类型' value={menu?.menuType} />
          <FieldItem label='路由' value={menu?.routePath} valueMaxLines={2} />
          <FieldItem label='组件' value={menu?.componentPath} valueMaxLines={2} />
          <FieldItem label='权限标识' value={menu?.permissionCode} valueMaxLines={2} />
          <FieldItem label='图标' value={menu?.icon} />
          <FieldItem label='排序' value={menu?.sortOrder} />
          <FieldItem label='隐藏' value={menu?.hidden ? '是' : '否'} />
          <FieldItem label='缓存' value={menu?.cached ? '是' : '否'} />
          <FieldItem label='状态' value={menu?.status} />
          <FieldItem label='创建时间' value={formatOptionalDateTime(menu?.createTime)} />
          <FieldItem label='更新时间' value={formatOptionalDateTime(menu?.updateTime)} />
          <FieldItem label='备注' value={menu?.remark} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function MenuManagementPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingMenu, setEditingMenu] = React.useState<MenuRspDTO | null>(null);
  const [parentMenu, setParentMenu] = React.useState<MenuRspDTO | null>(null);
  const [detailMenu, setDetailMenu] = React.useState<MenuRspDTO | null>(null);
  const query = useQuery(iamMenuTreeQueryOptions({ keyword: keyword.trim() || undefined }));
  const rows = React.useMemo(() => flattenMenuTree(query.data ?? []), [query.data]);
  const { withConfirm, confirmDialog } = useConfirmAction<[MenuRspDTO]>();

  const createMutation = useMutation({
    mutationFn: (request: MenuCreateReqDTO) => iamMenuCreate(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单已创建');
    }
  });
  const updateMutation = useMutation({
    mutationFn: (request: MenuUpdateReqDTO) => iamMenuUpdate(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单已更新');
    }
  });
  const statusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamMenuStatusUpdate>[0]) => iamMenuStatusUpdate(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单状态已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamMenuDelete>[0]) => iamMenuDelete(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单已删除');
    }
  });
  const confirmMenuStatus = React.useMemo(
    () =>
      withConfirm({
        title: () => '确认切换菜单状态',
        description: (menu) =>
          `确认将 ${menu.menuName ?? '该菜单'} ${menu.status === 'ENABLED' ? '停用' : '启用'}？`,
        confirmText: '确认',
        cancelText: '取消',
        run: async (menu) => {
          if (!menu.menuId) return;
          await statusMutation.mutateAsync({
            menuId: menu.menuId,
            status: nextStatus(menu.status)
          });
        }
      }),
    [statusMutation, withConfirm]
  );
  const confirmMenuDelete = React.useMemo(
    () =>
      withConfirm({
        title: () => '确认删除菜单',
        description: (menu) => `删除后 ${menu.menuName ?? '该菜单'} 不可恢复。`,
        confirmText: '确认删除',
        cancelText: '取消',
        run: async (menu) => {
          if (!menu.menuId) return;
          await deleteMutation.mutateAsync({ menuId: menu.menuId });
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
              placeholder='搜索菜单、编码或权限'
              className='h-8 w-60'
            />
            <Button variant='outline' size='sm' onClick={() => query.refetch()}>
              <Icons.rotateClockwise className='size-4' />
              刷新
            </Button>
            <PermissionGate permission={IAM_PERMISSIONS.menu.manage}>
              <Button
                size='sm'
                onClick={() => {
                  setEditingMenu(null);
                  setParentMenu(null);
                  setFormOpen(true);
                }}
              >
                <Icons.add className='size-4' />
                新增菜单
              </Button>
            </PermissionGate>
          </div>
          <div className='overflow-auto px-6 pb-6'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>权限标识</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className='text-right'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((menu) => (
                  <TableRow key={menu.menuId}>
                    <TableCell>
                      <Button
                        variant='link'
                        className='h-auto p-0 font-medium'
                        style={{ marginLeft: menu.depth * 18 }}
                        onClick={() => setDetailMenu(menu)}
                      >
                        {menu.menuName}
                      </Button>
                    </TableCell>
                    <TableCell>{menu.menuCode}</TableCell>
                    <TableCell>
                      <MenuTypeBadge type={menu.menuType} />
                    </TableCell>
                    <TableCell>{menu.permissionCode ?? '-'}</TableCell>
                    <TableCell>{menu.sortOrder ?? '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={menu.status} />
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        <PermissionGate permission={IAM_PERMISSIONS.menu.manage}>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='新增下级'
                            onClick={() => {
                              setEditingMenu(null);
                              setParentMenu(menu);
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
                              setEditingMenu(menu);
                              setParentMenu(null);
                              setFormOpen(true);
                            }}
                          >
                            <Icons.edit className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='切换状态'
                            onClick={() => confirmMenuStatus(menu)}
                          >
                            <Icons.rotate className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='删除'
                            onClick={() => confirmMenuDelete(menu)}
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
                    <TableCell colSpan={7} className='h-24 text-center text-muted-foreground'>
                      {query.isFetching ? '加载中' : '暂无菜单'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
      <MenuFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        menu={editingMenu}
        parent={parentMenu}
        tree={query.data ?? []}
        onSubmit={async (payload) => {
          if ('menuId' in payload) {
            await updateMutation.mutateAsync(payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
      />
      <MenuDetailSheet
        open={!!detailMenu}
        onOpenChange={(open) => !open && setDetailMenu(null)}
        menu={detailMenu}
      />
    </>
  );
}
