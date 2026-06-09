import { createFileRoute, redirect } from '@tanstack/react-router';

import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '系统管理',
  workspace: {
    tagEnabled: false,
    keepAlive: false
  },
  nav: {
    visible: true,
    group: 'overview',
    order: 25,
    kind: 'container',
    icon: 'settings',
    linkable: false
  }
});

export const Route = createFileRoute('/dashboard/system-management/')({
  ...meta,
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/system-management/dictionaries' });
  }
});
