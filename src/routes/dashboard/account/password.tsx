import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '修改密码',
  title: '账户：修改密码',
  nav: {
    visible: false,
    group: 'account',
    order: 20,
    icon: 'lock'
  },
  workspace: {
    keepAlive: false,
    tagEnabled: false
  }
});

export const Route = createFileRoute('/dashboard/account/password')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch(resolveDashboardHomeHref(), location));
  }
});
