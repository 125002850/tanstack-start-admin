import { createFileRoute } from '@tanstack/react-router';
import UserListingPage from '@/features/users/components/user-listing';
import UsersScreen from '@/features/users/components/users-screen';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '用户',
  title: '概览: 用户管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 30,
    icon: 'teams',
    shortcut: ['u', 'u']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/users')({
  ...meta,
  component: UsersPage
});

function UsersPage() {
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/users'
      render={() => <UsersScreen />}
      renderWhenDisabled={() => <UserListingPage />}
    />
  );
}
