import { createFileRoute, redirect } from '@tanstack/react-router';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    throw redirect({ to: resolveDashboardHomeHref() });
  }
});
