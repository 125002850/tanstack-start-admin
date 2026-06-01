import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { defineExpandConfig, type ExpandTab } from '@/types/data-table';
import type { User } from '../../api/types';

const ROLE_LABELS: Record<string, string> = {
  Developer: '开发者',
  Designer: '设计师',
  Manager: '管理者',
  QA: '测试',
  DevOps: '运维',
  'Product Owner': '产品负责人'
};

const STATUS_LABELS: Record<string, string> = {
  Active: '已激活',
  Inactive: '未激活',
  Invited: '已邀请'
};

function formatDateTime(value: string) {
  return format(new Date(value), 'yyyy-MM-dd HH:mm');
}

function UserOverviewPanel({ row }: { row: User }) {
  return (
    <div className='grid gap-4 lg:grid-cols-[1.35fr_0.95fr]'>
      <section className='bg-muted/35 flex flex-col gap-4 rounded-xl border px-4 py-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1'>
            <div className='text-lg font-semibold'>
              {row.first_name} {row.last_name}
            </div>
            <div className='text-muted-foreground text-sm'>用户编号 #{row.id}</div>
          </div>
          <Badge variant={row.status === 'Active' ? 'default' : row.status === 'Inactive' ? 'secondary' : 'outline'}>
            {STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        </div>
        <dl className='grid gap-3 sm:grid-cols-2'>
          <div className='rounded-lg border bg-background px-3 py-3'>
            <dt className='text-muted-foreground text-xs'>角色</dt>
            <dd className='mt-1 font-medium'>{ROLE_LABELS[row.role] ?? row.role}</dd>
          </div>
          <div className='rounded-lg border bg-background px-3 py-3'>
            <dt className='text-muted-foreground text-xs'>最近更新</dt>
            <dd className='mt-1 font-medium'>{formatDateTime(row.updated_at)}</dd>
          </div>
          <div className='rounded-lg border bg-background px-3 py-3'>
            <dt className='text-muted-foreground text-xs'>邮箱</dt>
            <dd className='mt-1 break-all font-medium'>{row.email}</dd>
          </div>
          <div className='rounded-lg border bg-background px-3 py-3'>
            <dt className='text-muted-foreground text-xs'>电话</dt>
            <dd className='mt-1 font-medium'>{row.phone}</dd>
          </div>
        </dl>
      </section>
      <section className='flex flex-col gap-3 rounded-xl border px-4 py-4'>
        <div className='text-sm font-medium'>管理提示</div>
        <ul className='text-muted-foreground space-y-3 text-sm'>
          <li className='rounded-lg border px-3 py-3'>
            当前账户状态为
            <span className='text-foreground mx-1 font-medium'>
              {STATUS_LABELS[row.status] ?? row.status}
            </span>
            ，适合在这里快速核对基础身份信息。
          </li>
          <li className='rounded-lg border px-3 py-3'>
            若需要编辑该用户资料，可直接使用表格右侧的
            <span className='text-foreground mx-1 font-medium'>编辑</span>
            操作，不会和详情面板互相抢事件。
          </li>
        </ul>
      </section>
    </div>
  );
}

function UserActivityPanel({ row }: { row: User }) {
  return (
    <div className='grid gap-3 md:grid-cols-2'>
      <article className='rounded-xl border px-4 py-4'>
        <div className='text-muted-foreground text-xs'>创建时间</div>
        <div className='mt-1 text-base font-semibold'>{formatDateTime(row.created_at)}</div>
        <p className='text-muted-foreground mt-3 text-sm'>用于确认账号的建立时点和数据来源窗口。</p>
      </article>
      <article className='rounded-xl border px-4 py-4'>
        <div className='text-muted-foreground text-xs'>更新时间</div>
        <div className='mt-1 text-base font-semibold'>{formatDateTime(row.updated_at)}</div>
        <p className='text-muted-foreground mt-3 text-sm'>最近一次档案改动时间，适合辅助排查最近的人事操作。</p>
      </article>
    </div>
  );
}

const userTableExpandTabs = [
  {
    id: 'overview',
    label: '概览',
    icon: <Icons.user className='size-4' />,
    render: (row: User) => <UserOverviewPanel row={row} />
  },
  {
    id: 'activity',
    label: '时间线',
    icon: <Icons.clock className='size-4' />,
    render: (row: User) => <UserActivityPanel row={row} />
  }
] as const satisfies readonly ExpandTab<User, string>[];

export const userTableExpandConfig = defineExpandConfig<User, 'id', typeof userTableExpandTabs>({
  rowKey: 'id',
  defaultTab: 'overview',
  tabs: userTableExpandTabs
});
