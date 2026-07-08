import { createFileRoute, redirect } from '@tanstack/react-router';
import ChangeRequiredPasswordView from '@/features/auth/components/change-required-password-view';
import { ensureIamMe } from '@/lib/api/iam/queries';
import { isAuthRequiredError } from '@/lib/api/iam/errors';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

function validateRedirectSearch(search: Record<string, unknown>): { redirect?: string } {
  return {
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined
  };
}

export const Route = createFileRoute('/auth/password/change-required')({
  validateSearch: validateRedirectSearch,
  head: () => ({
    meta: [{ title: '修改密码' }]
  }),
  loader: async ({ context, location }) => {
    try {
      const me = await ensureIamMe(context.queryClient);
      if (!me.mustChangePassword) {
        throw redirect({ to: resolveDashboardHomeHref() });
      }
      return me;
    } catch (error) {
      if (isAuthRequiredError(error)) {
        throw redirect({
          to: '/auth/sign-in',
          search: { redirect: `${location.pathname}${location.searchStr}` }
        });
      }
      throw error;
    }
  },
  component: ChangeRequiredPasswordView
});
