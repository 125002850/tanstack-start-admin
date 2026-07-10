import * as React from 'react';
import {
  createFileRoute,
  Outlet,
  redirect,
  type ErrorComponentProps
} from '@tanstack/react-router';
import { Icons } from '@/components/icons';
import KBar from '@/components/kbar';
import { DefaultErrorPage } from '@/components/layout/default-error-page';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspaceViewport } from '@/features/workspace-tabs/components/workspace-viewport';
import { useWorkspaceDevtools } from '@/features/workspace-tabs/lib/workspace-devtools';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';
import { useDashboardRouteTagSync } from '@/features/workspace-tabs/hooks/use-dashboard-route-tag-sync';
import { buildMenuTreeLookup } from '@/lib/router/menu-tree-resolver';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { useQuery } from '@tanstack/react-query';
import {
  isAuthRequiredError,
  isPasswordChangeRequiredError,
  isPermissionDeniedError
} from '@/lib/api/iam/errors';
import { baseConfig } from '@/config';
import { ensureDashboardRouteAccess } from '@/lib/router/dashboard-route-guard';

const meta = defineRouteMeta({
  label: '工作台',
  breadcrumb: { label: '工作台' },
  workspace: { tagEnabled: false, keepAlive: false }
});

export const Route = createFileRoute('/dashboard')({
  ...meta,
  head: () => ({
    meta: [
      { title: `${baseConfig.projectName}工作台` },
      {
        name: 'description',
        content: '后台管理框架与系统管理后台'
      },
      { name: 'robots', content: 'noindex, nofollow' }
    ]
  }),
  beforeLoad: async ({ context, location, matches }) => {
    try {
      const me = await ensureDashboardRouteAccess({
        queryClient: context.queryClient,
        matches
      });
      if (me.mustChangePassword) {
        throw redirect({
          to: '/auth/password/change-required',
          search: { redirect: `${location.pathname}${location.searchStr}` }
        });
      }
      return me;
    } catch (error) {
      if (isAuthRequiredError(error)) {
        throw redirect({
          to: '/auth/sign-in',
          search: { redirect: `${location.pathname}${location.searchStr}` }
        });
      }
      if (isPasswordChangeRequiredError(error)) {
        throw redirect({
          to: '/auth/password/change-required',
          search: { redirect: `${location.pathname}${location.searchStr}` }
        });
      }
      throw error;
    }
  },
  errorComponent: DashboardErrorComponent,
  component: DashboardLayout
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '页面加载时遇到未知异常。';
}

function DashboardErrorComponent({ error, reset }: ErrorComponentProps) {
  if (isPermissionDeniedError(error)) {
    return (
      <DefaultErrorPage
        code='403'
        title='没有访问权限'
        description='当前账号没有访问该页面或执行该操作的权限。'
        alertTitle='权限不足'
        alertDescription='请联系管理员确认角色、菜单和按钮权限配置。'
        action={{
          label: '返回概览',
          href: '/dashboard/overview',
          icon: Icons.arrowRight
        }}
      />
    );
  }

  return (
    <DefaultErrorPage
      code='500'
      title='系统异常'
      description='工作台加载时遇到异常，当前页面暂时不可用。'
      alertTitle='运行异常'
      alertDescription={getErrorMessage(error)}
      action={{
        label: '重试',
        icon: Icons.rotateClockwise,
        onClick: reset
      }}
    />
  );
}

function DashboardLayout() {
  const workspaceEnabled = isWorkspaceTabsEnabled();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const treeLookup = React.useMemo(() => buildMenuTreeLookup(me?.menus ?? []), [me?.menus]);
  useDashboardRouteTagSync(workspaceEnabled, treeLookup);
  useWorkspaceDevtools(workspaceEnabled);

  return (
    <KBar>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <InfobarProvider defaultOpen={false}>
            {workspaceEnabled && <WorkspaceViewport />}
            <Outlet />
            <InfoSidebar side='right' />
          </InfobarProvider>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
