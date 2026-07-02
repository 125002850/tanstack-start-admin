import { createFileRoute, redirect } from '@tanstack/react-router';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '控制台首页',
  workspace: { keepAlive: false }
});

export const Route = createFileRoute('/dashboard/')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch(resolveDashboardHomeHref(), location));
  }
});
