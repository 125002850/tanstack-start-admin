import { createFileRoute, redirect } from '@tanstack/react-router';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    throw redirect(createRedirectWithSearch(resolveDashboardHomeHref(), location));
  }
});
