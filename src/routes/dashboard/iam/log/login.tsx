import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { IAM_PERMISSIONS } from '@/features/iam/lib/constants';

const LoginLogPage = lazyRouteComponent(
  () => import('@/features/iam/components/log-pages'),
  'LoginLogPage'
);

const meta = defineRouteMeta({
  label: '登录日志',
  title: '权限管理：登录日志',
  requiredPermission: IAM_PERMISSIONS.log.loginQuery,
  nav: {
    visible: true,
    group: 'iam',
    order: 50,
    menuKey: 'iam_login_log',
    icon: 'login',
    shortcut: ['i', 'l']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/iam/log/login')({
  ...meta,
  component: LoginLogRoute
});

function LoginLogRoute() {
  return <WorkspacePageRoute render={() => <LoginLogPage />} />;
}
