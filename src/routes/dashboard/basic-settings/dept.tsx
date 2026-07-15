import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DeptManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/dept-management-page')
);

const meta = defineRouteMeta({
  title: '基础设置：部门管理',
  nav: {
    group: 'basicSettings',
    menuKey: 'iam_dept',
    icon: 'department',
    shortcut: ['b', 'd']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/basic-settings/dept')({
  ...meta,
  component: DeptPage
});

function DeptPage() {
  return <WorkspacePageRoute render={() => <DeptManagementPage />} />;
}
