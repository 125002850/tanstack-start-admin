import { QueryClientProvider } from '@tanstack/react-query';
import { createFileRoute, Outlet, useRouter } from '@tanstack/react-router';
import KBar from '@/components/kbar';
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

const meta = defineRouteMeta({
  label: '控制台',
  breadcrumb: { label: '控制台' },
  workspace: { tagEnabled: false, keepAlive: false }
});

export const Route = createFileRoute('/dashboard')({
  ...meta,
  head: () => ({
    meta: [
      { title: 'TanStack Dashboard Starter' },
      {
        name: 'description',
        content: 'Dashboard with TanStack Start and Shadcn'
      },
      { name: 'robots', content: 'noindex, nofollow' }
    ]
  }),
  component: DashboardLayout
});

function DashboardLayout() {
  const router = useRouter();
  const queryClient = router.options.context.queryClient;
  const workspaceEnabled = isWorkspaceTabsEnabled();
  useDashboardRouteTagSync(workspaceEnabled);
  useWorkspaceDevtools(workspaceEnabled);

  return (
    <KBar>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <InfobarProvider defaultOpen={false}>
            <QueryClientProvider client={queryClient}>
              {workspaceEnabled && <WorkspaceViewport />}
              <Outlet />
            </QueryClientProvider>
            <InfoSidebar side='right' />
          </InfobarProvider>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
