import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const OperationLogPage = lazyRouteComponent(
  () => import('@/features/iam/components/log-pages'),
  'OperationLogPage'
);

const meta = defineRouteMeta({
  title: '日志管理：操作日志',
  nav: {
    group: 'logManagement',
    menuKey: 'iam_operation_log',
    icon: 'clipboardList',
    shortcut: ['l', 'o']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/log-management/operation')({
  ...meta,
  component: OperationLogRoute
});

function OperationLogRoute() {
  return <WorkspacePageRoute render={() => <OperationLogPage />} />;
}
