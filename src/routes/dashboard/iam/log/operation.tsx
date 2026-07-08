import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { ensureIamPermission } from '@/lib/api/iam/permissions';
import { IAM_PERMISSIONS } from '@/features/iam/lib/constants';

const OperationLogPage = lazyRouteComponent(
  () => import('@/features/iam/components/log-pages'),
  'OperationLogPage'
);

const meta = defineRouteMeta({
  label: '操作日志',
  title: '权限管理：操作日志',
  requiredPermission: IAM_PERMISSIONS.log.operationQuery,
  nav: {
    visible: true,
    group: 'iam',
    order: 60,
    menuKey: 'iam_operation_log',
    icon: 'clipboardList',
    shortcut: ['i', 'o']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/iam/log/operation')({
  ...meta,
  beforeLoad: ({ context }) =>
    ensureIamPermission(context.queryClient, IAM_PERMISSIONS.log.operationQuery),
  component: OperationLogRoute
});

function OperationLogRoute() {
  return <WorkspacePageRoute render={() => <OperationLogPage />} />;
}
