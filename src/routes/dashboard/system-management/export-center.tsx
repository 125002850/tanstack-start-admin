import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const ExportCenterManagementPage = lazyRouteComponent(
  () => import('@/features/export-center/components/export-center-management-page')
);
const ExportCenterScreen = lazyRouteComponent(
  () => import('@/features/export-center/components/export-center-screen')
);

const meta = defineRouteMeta({
  label: '导出中心',
  title: '系统管理：导出中心',
  nav: {
    visible: true,
    group: 'systemManagement',
    order: 20,
    menuKey: 'export-center',
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
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/system-management/export-center'
      render={() => <ExportCenterScreen />}
      renderWhenDisabled={() => <ExportCenterManagementPage />}
    />
  );
}
