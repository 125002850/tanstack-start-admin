import type { ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldItem } from '@/components/ui/detail-field';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MenuRspDTO } from '@/lib/api/clients/service';

import { formatOptionalDateTime, MenuTypeBadge, StatusBadge } from '../lib/format';

interface MenuDetailsProps {
  record: MenuRspDTO | null;
  parentMenuName: string;
  canManage: boolean;
  isEnablingPageCache: boolean;
  onCreateChild: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEnablePageCache: () => void;
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

function MenuDetailAction({
  label,
  icon,
  variant = 'outline',
  isLoading,
  onClick
}: {
  label: string;
  icon: ReactNode;
  variant?: 'outline' | 'destructive';
  isLoading?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size='icon'
          aria-label={label}
          isLoading={isLoading ? true : undefined}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MenuDetails({
  record,
  parentMenuName,
  canManage,
  isEnablingPageCache,
  onCreateChild,
  onEdit,
  onToggleStatus,
  onDelete,
  onEnablePageCache
}: MenuDetailsProps) {
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
                </>
              ) : (
                '从左侧菜单树选择目录或页面菜单后查看详情'
              )}
            </CardDescription>
          </div>
          {record && canManage ? (
            <div className='flex flex-wrap items-center justify-end gap-2'>
              {record.menuType !== 'BUTTON' ? (
                <MenuDetailAction
                  label='新增下级菜单'
                  icon={<Icons.add className='size-4' />}
                  onClick={onCreateChild}
                />
              ) : null}
              {record.menuType === 'MENU' && record.cached !== true ? (
                <MenuDetailAction
                  label='开启页面缓存'
                  icon={<Icons.databaseCog className='size-4' />}
                  isLoading={isEnablingPageCache}
                  onClick={onEnablePageCache}
                />
              ) : null}
              <MenuDetailAction
                label='编辑菜单'
                icon={<Icons.edit className='size-4' />}
                onClick={onEdit}
              />
              <MenuDetailAction
                label='切换菜单状态'
                icon={<Icons.rotate className='size-4' />}
                onClick={onToggleStatus}
              />
              <MenuDetailAction
                label='删除菜单'
                icon={<Icons.trash className='size-4' />}
                variant='destructive'
                onClick={onDelete}
              />
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
            <FieldItem label='权限标识' value={record.permissionCode} valueMaxLines={2} />
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
