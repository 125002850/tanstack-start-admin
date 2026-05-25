import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import UserListingPage from '@/features/users/components/user-listing';
import { usersInfoContent } from '@/features/users/info-content';
import { UserFormSheetTrigger } from '@/features/users/components/user-form-sheet';
import { columns as userColumns } from '@/features/users/components/users-table/columns';
import { parseSortingState } from '@/lib/parsers';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { ROLE_VALUES } from '@/features/users/components/users-table/options';

const meta = defineRouteMeta({
  label: '用户',
  title: '概览: 用户管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 30,
    icon: 'teams',
    shortcut: ['u', 'u'],
  },
  page: {
    title: 'Users',
    description: 'Manage users (React Query + search params table pattern.)',
    infoContent: usersInfoContent,
  },
});

const userColumnIds = userColumns.map((column) => column.id).filter(Boolean) as string[];

const usersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
  perPage: z.coerce.number().int().min(1).optional().catch(10),
  name: z.string().trim().max(120).optional().catch(undefined),
  gender: z.string().trim().max(40).optional().catch(undefined),
  role: z.enum(ROLE_VALUES).optional().catch(undefined),
  sort: z
    .string()
    .trim()
    .max(512)
    .optional()
    .catch(undefined)
    .transform((value) => {
      if (!value) return undefined;

      return parseSortingState(value, userColumnIds).length > 0 ? value : undefined;
    })
});

export const Route = createFileRoute('/dashboard/users')({
  ...meta,
  validateSearch: zodValidator(usersSearchSchema),
  beforeLoad: ({ buildLocation, location, search }) => {
    const normalizedLocation = buildLocation({
      to: location.pathname,
      search
    });

    if (normalizedLocation.href !== location.href) {
      throw redirect({
        to: location.pathname,
        search,
        replace: true
      });
    }
  },
  component: UsersPage
});

function UsersPage() {
  return (
    <PageContainer pageHeaderAction={<UserFormSheetTrigger />}>
      <UserListingPage />
    </PageContainer>
  );
}
