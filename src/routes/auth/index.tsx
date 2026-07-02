import { createFileRoute, redirect } from '@tanstack/react-router';
import { createRedirectWithSearch } from '@/lib/router/redirect-search';

export const Route = createFileRoute('/auth/')({
  beforeLoad: ({ location }) => {
    throw redirect(createRedirectWithSearch('/auth/sign-in', location));
  }
});
