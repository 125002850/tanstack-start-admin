import { createFileRoute } from '@tanstack/react-router';
import NotificationsPage from '@/features/notifications/components/notifications-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '通知',
  title: 'Dashboard: Notifications',
  workspace: {},
  nav: {
    visible: true,
    group: 'account',
    order: 10,
    icon: 'notification',
    shortcut: ['n', 'n']
  },
  page: {
    title: 'Notifications',
    description: 'View and manage all your notifications.'
  }
});

export const Route = createFileRoute('/dashboard/notifications')({
  ...meta,
  component: NotificationsPageComponent
});

function NotificationsPageComponent() {
  return (
    <WorkspacePageBoundary tabId='/dashboard/notifications' render={() => <NotificationsPage />} />
  );
}
