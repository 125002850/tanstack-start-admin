import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const OverviewManagementPage = lazyRouteComponent(
  () => import('@/features/overview/components/overview-page'),
  'OverviewManagementPage'
);

const meta = defineRouteMeta({
  label: '仪表盘',
  workspace: {
    closable: false
  },
  nav: {
    visible: true,
    group: 'overview',
    order: 10,
    icon: 'dashboard',
    shortcut: ['o', 'v']
  }
});

export const Route = createFileRoute('/dashboard/overview')({
  ...meta,
  component: OverviewPage
});

function OverviewPage() {
  return <WorkspacePageRoute render={() => <OverviewManagementPage />} />;
}
