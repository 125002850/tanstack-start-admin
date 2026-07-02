import { createFileRoute, redirect } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

const meta = defineRouteMeta({
  label: '表单',
  workspace: { keepAlive: false },
  nav: {
    visible: false,
    group: 'components',
    order: 10,
    kind: 'container',
    icon: 'forms',
    linkable: false
  }
});

export const Route = createFileRoute('/dashboard/forms/')({
  ...meta,
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch('/dashboard/forms/basic', location));
  }
});
