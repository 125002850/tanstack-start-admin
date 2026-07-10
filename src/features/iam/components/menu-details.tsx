import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldItem } from '@/components/ui/detail-field';
import { NAV_GROUP_META, type AppNavGroupKey } from '@/lib/router/app-route-meta';
import type { MenuRspDTO } from '@/lib/api/clients/service';

import { formatOptionalDateTime, MenuTypeBadge, StatusBadge } from '../lib/format';

interface MenuDetailsProps {
  record: MenuRspDTO | null;
  parentMenuName: string;
  canManage: boolean;
  onCreateChild: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function AuditInfo({
  label,
  operator,
  time
}: {
  label: string;
  operator?: number | null;
  time?: string | null;
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1 rounded-[10px] border border-transparent bg-muted/40 px-3 py-2.5'>
      <span className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
        {label}
      </span>
      <span className='text-muted-foreground text-xs'>{operator ?? '-'}</span>
      <span className='min-w-0 truncate text-sm font-medium tabular-nums'>
        {formatOptionalDateTime(time)}
      </span>
    </div>
  );
}

function resolveNavigationGroup(menuCode?: string) {
  if (!menuCode || !Object.hasOwn(NAV_GROUP_META, menuCode)) return null;

  return NAV_GROUP_META[menuCode as AppNavGroupKey];
}

export function MenuDetails({
  record,
  parentMenuName,
  canManage,
  onCreateChild,
  onEdit,
  onToggleStatus,
  onDelete
}: MenuDetailsProps) {
  const navigationGroup =
    record?.menuType === 'DIR' ? resolveNavigationGroup(record.menuCode) : null;

  return (
    <Card role='region' aria-label='菜单详情'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='flex min-w-0 flex-col gap-1.5'>
            <CardTitle>{record?.menuName ?? '请选择菜单'}</CardTitle>
            <CardDescription className='flex flex-wrap items-center gap-2'>
              {record ? (
                <>
                  <span>{record.menuCode ?? '-'}</span>
                  <MenuTypeBadge type={record.menuType} />
                  <StatusBadge status={record.status} />
                  {record.menuType === 'DIR' ? (
                    navigationGroup ? (
                      <Badge variant='secondary'>{`导航分组：${navigationGroup.label}`}</Badge>
                    ) : (
                      <Badge variant='destructive'>未匹配前端导航分组</Badge>
                    )
                  ) : null}
                </>
              ) : (
                '从左侧菜单树选择目录或页面菜单后查看详情'
              )}
            </CardDescription>
          </div>
          {record && canManage ? (
            <div className='flex flex-wrap items-center justify-end gap-2'>
              {record.menuType !== 'BUTTON' ? (
                <Button variant='outline' size='sm' onClick={onCreateChild}>
                  <Icons.add className='size-4' />
                  新增下级菜单
                </Button>
              ) : null}
              <Button variant='outline' size='icon' aria-label='编辑菜单' onClick={onEdit}>
                <Icons.edit className='size-4' />
              </Button>
              <Button
                variant='outline'
                size='icon'
                aria-label='切换菜单状态'
                onClick={onToggleStatus}
              >
                <Icons.rotate className='size-4' />
              </Button>
              <Button variant='destructive' size='icon' aria-label='删除菜单' onClick={onDelete}>
                <Icons.trash className='size-4' />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {record ? (
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            <FieldItem label='菜单 ID' value={record.menuId} />
            <FieldItem label='上级菜单' value={parentMenuName} />
            <FieldItem label='菜单编码' value={record.menuCode} />
            <FieldItem label='路由路径' value={record.routePath} valueMaxLines={2} />
            <FieldItem label='组件路径' value={record.componentPath} valueMaxLines={2} />
            <FieldItem label='权限标识' value={record.permissionCode} valueMaxLines={2} />
            <FieldItem label='图标' value={record.icon} />
            <FieldItem label='排序' value={record.sortOrder} />
            <FieldItem label='隐藏' value={record.hidden ? '是' : '否'} />
            <FieldItem label='页面缓存' value={record.cached ? '是' : '否'} />
            <AuditInfo label='创建信息' operator={record.createBy} time={record.createTime} />
            <AuditInfo label='更新信息' operator={record.updateBy} time={record.updateTime} />
            <FieldItem label='备注' value={record.remark} valueMaxLines={2} />
          </div>
        ) : (
          <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm'>
            暂无可展示的菜单详情
          </div>
        )}
      </CardContent>
    </Card>
  );
}
