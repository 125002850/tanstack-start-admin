import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '日志管理',
  workspace: {
    tagEnabled: false,
    keepAlive: false
  },
  nav: {
    isContainer: true
  }
});

export const Route = createFileRoute('/dashboard/log-management/')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch('/dashboard/log-management/login', location));
  }
});
