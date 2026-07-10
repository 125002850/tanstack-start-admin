import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const ExportCenterManagementPage = lazyRouteComponent(
  () => import('@/features/export-center/components/export-center-management-page')
);

const meta = defineRouteMeta({
  title: '系统管理：导出中心',
  nav: {
    menuKey: 'export_center',
    icon: 'download',
    shortcut: ['e', 'c']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/system-management/export-center')({
  ...meta,
  component: ExportCenterPage
});

function ExportCenterPage() {
  return <WorkspacePageRoute render={() => <ExportCenterManagementPage />} />;
}
