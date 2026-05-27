import { createFileRoute } from '@tanstack/react-router';
import NotificationsPage from '@/features/notifications/components/notifications-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';

const meta = defineRouteMeta({
  label: '通知',
  title: 'Dashboard: Notifications',
  workspace: {},
  nav: {
    visible: true,
    group: 'account',
    order: 10,
    icon: 'notification',
    shortcut: ['n', 'n'],
  },
  page: {
    title: 'Notifications',
    description: 'View and manage all your notifications.',
  },
});

export const Route = createFileRoute('/dashboard/notifications')({
  ...meta,
  component: NotificationsPageComponent
});

function NotificationsPageComponent() {
  if (!isWorkspaceTabsEnabled()) {
    return <NotificationsPage />
  }

  return (
    <WorkspacePageBoundary
      tabId='/dashboard/notifications'
      initialTitle='通知'
      render={() => <NotificationsPage />}
    />
  )
}
