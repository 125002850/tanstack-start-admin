import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const NotificationsManagementPage = lazyRouteComponent(
  () => import('@/features/notifications/components/notifications-page'),
  'NotificationsManagementPage'
);

const meta = defineRouteMeta({
  label: '通知',
  title: '开发示例：通知',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 40,
    icon: 'notification',
    shortcut: ['n', 'n']
  }
});

export const Route = createFileRoute('/dashboard/notifications')({
  ...meta,
  component: NotificationsPageComponent
});

function NotificationsPageComponent() {
  return <WorkspacePageRoute render={() => <NotificationsManagementPage />} />;
}
