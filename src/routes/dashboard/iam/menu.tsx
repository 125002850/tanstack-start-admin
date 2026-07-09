import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { IAM_PERMISSIONS } from '@/features/iam/lib/constants';

const MenuManagementPage = lazyRouteComponent(
  () => import('@/features/iam/components/menu-management-page')
);

const meta = defineRouteMeta({
  label: '菜单管理',
  title: '权限管理：菜单管理',
  requiredPermission: IAM_PERMISSIONS.menu.manage,
  nav: {
    visible: true,
    group: 'iam',
    order: 40,
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
