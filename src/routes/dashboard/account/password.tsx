import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const AccountPasswordPage = lazyRouteComponent(
  () => import('@/features/iam/components/account-pages'),
  'AccountPasswordPage'
);

const meta = defineRouteMeta({
  label: '修改密码',
  title: '账户：修改密码',
  nav: {
    visible: true,
    group: 'account',
    order: 20,
    icon: 'lock',
    shortcut: ['a', 'w']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/account/password')({
  ...meta,
  component: PasswordRoute
});

function PasswordRoute() {
  return <WorkspacePageRoute render={() => <AccountPasswordPage />} />;
}
