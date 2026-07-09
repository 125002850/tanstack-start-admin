import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { IAM_PERMISSIONS } from '@/features/iam/lib/constants';

const RoleManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/role-management-page')
);

const meta = defineRouteMeta({
  label: '角色管理',
  title: '权限管理：角色管理',
  requiredPermission: IAM_PERMISSIONS.role.manage,
  nav: {
    visible: true,
    group: 'iam',
    order: 30,
    menuKey: 'iam_role',
    icon: 'shieldCheck',
    shortcut: ['i', 'r']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/iam/role')({
  ...meta,
  component: RolePage
});

function RolePage() {
  return <WorkspacePageRoute render={() => <RoleManagementPage />} />;
}
