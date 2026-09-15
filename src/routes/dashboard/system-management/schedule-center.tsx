import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const ScheduleCenterManagementPage = lazyRouteComponent(
  () => import('@/features/schedule-center/components/schedule-center-management-page')
);

const meta = defineRouteMeta({
  requiredPermission: 'system:schedule:manage',
  label: '调度中心',
  nav: {
    visible: true,
    group: 'systemManagement',
    order: 30,
    menuKey: 'schedule-center',
    icon: 'clock',
    shortcut: ['s', 'c']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/system-management/schedule-center')({
  ...meta,
  component: ScheduleCenterPage
});

function ScheduleCenterPage() {
  return (
    <WorkspacePageRoute contentSizing='contained' render={() => <ScheduleCenterManagementPage />} />
  );
}
