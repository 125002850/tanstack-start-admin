import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '基础设置',
  workspace: {
    tagEnabled: false,
    keepAlive: false
  },
  nav: {
    isContainer: true
  }
});

export const Route = createFileRoute('/_app/basic-settings/')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch('/basic-settings/staff', location));
  }
});
