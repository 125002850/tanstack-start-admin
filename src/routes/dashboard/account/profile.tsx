import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const AccountProfilePage = lazyRouteComponent(
  () => import('@/features/iam/components/account-pages'),
  'AccountProfilePage'
);

const meta = defineRouteMeta({
  label: '个人资料',
  title: '账户：个人资料',
  nav: {
    visible: true,
    group: 'account',
    order: 10,
    icon: 'account',
    shortcut: ['a', 'p']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/account/profile')({
  ...meta,
  component: ProfileRoute
});

function ProfileRoute() {
  return <WorkspacePageRoute render={() => <AccountProfilePage />} />;
}
