import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const StaffManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/staff-management-page')
);

const meta = defineRouteMeta({
  title: '基础设置：员工管理',
  nav: {
    group: 'basicSettings',
    menuKey: 'iam_staff',
    icon: 'teams',
    shortcut: ['b', 's']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/basic-settings/staff')({
  ...meta,
  component: StaffPage
});

function StaffPage() {
  return <WorkspacePageRoute render={() => <StaffManagementPage />} />;
}
