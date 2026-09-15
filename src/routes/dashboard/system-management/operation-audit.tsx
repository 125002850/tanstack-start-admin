import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
const Management = lazyRouteComponent(
  () => import('@/features/operation-audit/components/operation-audit-management-page')
);
export const Route = createFileRoute('/dashboard/system-management/operation-audit')({
  ...defineRouteMeta({
    label: '操作审计',
    nav: {
      visible: true,
      group: 'systemManagement',
      order: 40,
      menuKey: 'operation-audit',
      icon: 'chartInfographic'
    }
  }),
  component: () => <WorkspacePageRoute contentSizing='contained' render={() => <Management />} />
});
