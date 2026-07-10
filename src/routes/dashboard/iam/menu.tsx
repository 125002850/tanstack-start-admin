import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const MenuManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/menu-management-page')
);

const meta = defineRouteMeta({
  title: '权限管理：菜单管理',
  nav: {
    menuKey: 'iam_menu',
    icon: 'settings',
    shortcut: ['i', 'm']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/iam/menu')({
  ...meta,
  component: MenuPage
});

function MenuPage() {
  return <WorkspacePageRoute render={() => <MenuManagementPage />} />;
}
