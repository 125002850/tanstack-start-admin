import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '权限管理',
  workspace: {
    tagEnabled: false,
    keepAlive: false
  },
  nav: {
    isContainer: true
  }
});

export const Route = createFileRoute('/dashboard/iam/')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch('/dashboard/iam/staff', location));
  }
});
