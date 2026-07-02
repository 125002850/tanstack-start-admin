import { createFileRoute, redirect } from '@tanstack/react-router';

import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '系统管理',
  workspace: {
    tagEnabled: false,
    keepAlive: false
  },
  nav: {
    visible: false,
    group: 'systemManagement',
    order: 0
  }
});

export const Route = createFileRoute('/dashboard/system-management/')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch('/dashboard/system-management/dictionaries', location));
  }
});
