import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const SheetFormDemo = lazyRouteComponent(
  () => import('@/features/forms/components/sheet-form-demo')
);

const meta = defineRouteMeta({
  label: '抽屉与弹窗',
  title: '开发示例：抽屉与弹窗',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 13,
    parentId: '/dashboard/forms',
    icon: 'forms'
  }
});

export const Route = createFileRoute('/dashboard/forms/sheet-form')({
  ...meta,
  component: SheetFormPage
});

function SheetFormPage() {
  return <WorkspacePageRoute render={() => <SheetFormDemo />} />;
}
