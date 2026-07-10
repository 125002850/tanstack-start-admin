import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const StaffManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/staff-management-page')
);

const meta = defineRouteMeta({
  title: '权限管理：员工管理',
  nav: {
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
