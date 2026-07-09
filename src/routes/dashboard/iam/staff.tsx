import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { IAM_PERMISSIONS } from '@/features/iam/lib/constants';

const StaffManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/staff-management-page')
);

const meta = defineRouteMeta({
  label: '员工管理',
  title: '权限管理：员工管理',
  requiredPermission: IAM_PERMISSIONS.staff.query,
  nav: {
    visible: true,
    group: 'iam',
    order: 10,
    menuKey: 'iam_staff',
    icon: 'teams',
    shortcut: ['i', 's']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/iam/staff')({
  ...meta,
  component: StaffPage
});

function StaffPage() {
  return <WorkspacePageRoute render={() => <StaffManagementPage />} />;
}
