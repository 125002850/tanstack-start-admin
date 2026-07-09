import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '个人资料',
  title: '账户：个人资料',
  nav: {
    visible: false,
    group: 'account',
    order: 10,
    icon: 'account'
  },
  workspace: {
    keepAlive: false,
    tagEnabled: false
  }
});

export const Route = createFileRoute('/dashboard/account/profile')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch(resolveDashboardHomeHref(), location));
  }
});
