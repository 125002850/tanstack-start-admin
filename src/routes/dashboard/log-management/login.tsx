import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const LoginLogPage = lazyRouteComponent(
  () => import('@/features/iam/components/log-pages'),
  'LoginLogPage'
);

const meta = defineRouteMeta({
  title: '日志管理：登录日志',
  nav: {
    group: 'logManagement',
    menuKey: 'iam_login_log',
    icon: 'login',
    shortcut: ['l', 'l']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/log-management/login')({
  ...meta,
  component: LoginLogRoute
});

function LoginLogRoute() {
  return <WorkspacePageRoute render={() => <LoginLogPage />} />;
}
