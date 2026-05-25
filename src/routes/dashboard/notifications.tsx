import { createFileRoute } from '@tanstack/react-router';
import NotificationsPage from '@/features/notifications/components/notifications-page';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '通知',
  documentTitle: 'Dashboard: Notifications',
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
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => <NotificationsPage />
});
