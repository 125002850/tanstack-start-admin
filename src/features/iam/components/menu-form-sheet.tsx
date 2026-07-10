import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
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
import type { MenuCreateReqDTO, MenuRspDTO, MenuUpdateReqDTO } from '@/lib/api/clients/service';
import { ENABLE_STATUS_OPTIONS, MENU_TYPE_OPTIONS } from '../lib/constants';
import { flattenMenuTree, menuSelectOptions } from '../lib/tree';

export type MenuFormValues = {
  parentId: string;
  menuCode: string;
  menuName: string;
  menuType: 'DIR' | 'MENU' | 'BUTTON';
  routePath: string;
  componentPath: string;
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
  sortOrder: '10',
  hidden: false,
  cached: true,
  status: 'ENABLED',
  permissionCode: '',
  remark: ''
};

function FieldShell({
  label,
  controlId,
  children
}: {
  label: string;
  controlId: string;
  children: React.ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      {children}
    </Field>
  );
}

export default function MenuFormSheet({
  open,
  onOpenChange,
  menu,
  parent,
  initialMenuType,
  tree,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu?: MenuRspDTO | null;
  parent?: MenuRspDTO | null;
  initialMenuType?: MenuFormValues['menuType'];
  tree: readonly MenuRspDTO[];
  onSubmit: (payload: MenuCreateReqDTO | MenuUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!menu?.menuId;
  const isButtonCreate = !isEdit && initialMenuType === 'BUTTON';
  const menuTypeOptions =
    !isEdit && !isButtonCreate
      ? MENU_TYPE_OPTIONS.filter((option) => option.value !== 'BUTTON')
      : MENU_TYPE_OPTIONS;
  const [values, setValues] = React.useState<MenuFormValues>(emptyValues);
  const parentOptions = React.useMemo(
    () => menuSelectOptions(tree, menu?.menuId),
    [menu?.menuId, tree]
  );

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
          : (initialMenuType ?? 'MENU'),
      routePath: menu?.routePath ?? '',
      componentPath: menu?.componentPath ?? '',
      sortOrder: String(menu?.sortOrder ?? 10),
      hidden: menu?.hidden ?? false,
      cached: menu?.cached ?? emptyValues.cached,
      status: menu?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      permissionCode: menu?.permissionCode ?? '',
      remark: menu?.remark ?? ''
    });
  }, [initialMenuType, isEdit, menu, open, parent]);

  const update = React.useCallback(
    (patch: Partial<MenuFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const menuType = isButtonCreate ? 'BUTTON' : values.menuType;
      const parentId = isEdit
        ? values.parentId === 'ROOT'
          ? undefined
          : Number(values.parentId)
        : parent?.menuId;
      if (!values.menuCode.trim() || !values.menuName.trim()) {
        toast.error('请填写菜单编码和名称');
        return;
      }
      if (menuType === 'BUTTON' && !values.permissionCode.trim()) {
        toast.error('按钮权限必须填写权限标识');
        return;
      }
      if (
        menuType === 'BUTTON' &&
        !flattenMenuTree(tree).some(
          (candidate) => candidate.menuId === parentId && candidate.menuType === 'MENU'
        )
      ) {
        toast.error('按钮权限必须属于页面菜单');
        return;
      }
      const sortOrder = Number(values.sortOrder);
      const payload = {
        parentId,
        menuCode: values.menuCode.trim(),
        menuName: values.menuName.trim(),
        menuType,
        routePath: values.routePath.trim() || undefined,
        componentPath: values.componentPath.trim() || undefined,
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
    [isButtonCreate, isEdit, menu?.menuId, onOpenChange, onSubmit, parent?.menuId, tree, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? '编辑菜单' : isButtonCreate ? '新增按钮权限' : '新增菜单'}
          </SheetTitle>
          <SheetDescription>
            {isButtonCreate && parent
              ? `上级菜单：${parent.menuName ?? parent.menuCode ?? '-'}`
              : '维护目录、页面菜单和按钮权限节点。'}
          </SheetDescription>
        </SheetHeader>
        <form id='menu-form' className='min-h-0 flex-1 overflow-auto' onSubmit={handleSubmit}>
          <FieldGroup className='gap-4'>
            <FieldShell label='上级菜单' controlId='iam-menu-parent'>
              <Select
                value={values.parentId}
                disabled={!isEdit}
                onValueChange={(parentId) => update({ parentId })}
              >
                <SelectTrigger id='iam-menu-parent' className='w-full'>
                  <SelectValue placeholder='根菜单' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='ROOT'>根菜单</SelectItem>
                    {parentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldShell>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldShell label='菜单编码' controlId='iam-menu-code'>
                <Input
                  id='iam-menu-code'
                  value={values.menuCode}
                  onChange={(event) => update({ menuCode: event.target.value })}
                />
              </FieldShell>
              <FieldShell label='菜单名称' controlId='iam-menu-name'>
                <Input
                  id='iam-menu-name'
                  value={values.menuName}
                  onChange={(event) => update({ menuName: event.target.value })}
                />
              </FieldShell>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldShell label='类型' controlId='iam-menu-type'>
                <Select
                  value={values.menuType}
                  disabled={isButtonCreate}
                  onValueChange={(menuType) =>
                    update({ menuType: menuType as MenuFormValues['menuType'] })
                  }
                >
                  <SelectTrigger id='iam-menu-type' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {menuTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldShell>
              <FieldShell label='状态' controlId='iam-menu-status'>
                <Select
                  value={values.status}
                  onValueChange={(status) => update({ status: status as MenuFormValues['status'] })}
                >
                  <SelectTrigger id='iam-menu-status' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ENABLE_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldShell>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldShell label='路由路径' controlId='iam-menu-route-path'>
                <Input
                  id='iam-menu-route-path'
                  value={values.routePath}
                  onChange={(event) => update({ routePath: event.target.value })}
                />
              </FieldShell>
              <FieldShell label='组件路径' controlId='iam-menu-component-path'>
                <Input
                  id='iam-menu-component-path'
                  value={values.componentPath}
                  onChange={(event) => update({ componentPath: event.target.value })}
                />
              </FieldShell>
            </div>
            <FieldShell label='权限标识' controlId='iam-menu-permission-code'>
              <Input
                id='iam-menu-permission-code'
                value={values.permissionCode}
                onChange={(event) => update({ permissionCode: event.target.value })}
              />
            </FieldShell>
            <FieldShell label='排序' controlId='iam-menu-sort-order'>
              <Input
                id='iam-menu-sort-order'
                inputMode='numeric'
                value={values.sortOrder}
                onChange={(event) => update({ sortOrder: event.target.value })}
              />
            </FieldShell>
            <div className='flex flex-wrap gap-6'>
              <Field orientation='horizontal'>
                <Checkbox
                  id='iam-menu-hidden'
                  checked={values.hidden}
                  onCheckedChange={(checked) => update({ hidden: checked === true })}
                />
                <FieldLabel htmlFor='iam-menu-hidden'>隐藏</FieldLabel>
              </Field>
              <Field orientation='horizontal'>
                <Checkbox
                  id='iam-menu-cached'
                  checked={values.cached}
                  onCheckedChange={(checked) => update({ cached: checked === true })}
                />
                <FieldLabel htmlFor='iam-menu-cached'>页面缓存</FieldLabel>
              </Field>
            </div>
            <FieldShell label='备注' controlId='iam-menu-remark'>
              <Textarea
                id='iam-menu-remark'
                value={values.remark}
                onChange={(event) => update({ remark: event.target.value })}
              />
            </FieldShell>
          </FieldGroup>
        </form>
        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form='menu-form'>
            {isEdit ? '保存修改' : isButtonCreate ? '创建按钮权限' : '创建菜单'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
