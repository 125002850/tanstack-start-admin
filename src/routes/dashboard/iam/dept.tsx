import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { IAM_PERMISSIONS } from '@/features/iam/lib/constants';

const DeptManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/dept-management-page')
);

const meta = defineRouteMeta({
  label: '部门管理',
  title: '权限管理：部门管理',
  requiredPermission: IAM_PERMISSIONS.dept.manage,
  nav: {
    visible: true,
    group: 'iam',
    order: 20,
    menuKey: 'iam_dept',
    icon: 'workspace',
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
