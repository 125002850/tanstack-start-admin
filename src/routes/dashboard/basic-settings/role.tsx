import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const RoleManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/role-management-page')
);

const meta = defineRouteMeta({
  title: '基础设置：角色管理',
  nav: {
    group: 'basicSettings',
    menuKey: 'iam_role',
    icon: 'role',
    shortcut: ['b', 'r']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/basic-settings/role')({
  ...meta,
  component: RolePage
});

function RolePage() {
  return <WorkspacePageRoute render={() => <RoleManagementPage />} />;
}
