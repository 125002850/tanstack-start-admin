import { createFileRoute } from '@tanstack/react-router';
import NotificationsPage from '@/features/notifications/components/notifications-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '通知',
  title: 'Dashboard: Notifications',
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
  component: () => <NotificationsPage />
});
