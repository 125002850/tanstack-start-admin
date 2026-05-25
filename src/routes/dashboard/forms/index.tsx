import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
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
  ...meta,
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/forms/basic' });
  }
});
