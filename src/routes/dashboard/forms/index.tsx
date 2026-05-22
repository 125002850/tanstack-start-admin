import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '表单',
  nav: {
    visible: true,
    group: 'components',
    order: 10,
    kind: 'container',
    icon: 'forms',
    linkable: false,
  },
});

export const Route = createFileRoute('/dashboard/forms/')({
  staticData,
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/forms/basic' });
  }
});
