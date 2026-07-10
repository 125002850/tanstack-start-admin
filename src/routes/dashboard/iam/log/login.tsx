import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const LoginLogPage = lazyRouteComponent(
  () => import('@/features/iam/components/log-pages'),
  'LoginLogPage'
);

const meta = defineRouteMeta({
  title: '权限管理：登录日志',
  nav: {
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
