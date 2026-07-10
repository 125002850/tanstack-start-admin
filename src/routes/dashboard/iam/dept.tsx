import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DeptManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/dept-management-page')
);

const meta = defineRouteMeta({
  title: '权限管理：部门管理',
  nav: {
    menuKey: 'iam_dept',
    icon: 'department',
    shortcut: ['i', 'd']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/iam/dept')({
  ...meta,
  component: DeptPage
});

function DeptPage() {
  return <WorkspacePageRoute render={() => <DeptManagementPage />} />;
}
