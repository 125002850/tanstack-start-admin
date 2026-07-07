import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const DemoForm = lazyRouteComponent(() => import('@/components/forms/demo-form'));

const meta = defineRouteMeta({
  label: '基础表单',
  title: '开发示例：基础表单',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 11,
    parentId: '/dashboard/forms',
    icon: 'forms',
    shortcut: ['f', 'f']
  }
});

export const Route = createFileRoute('/dashboard/forms/basic')({
  ...meta,
  component: BasicFormPage
});

function BasicFormPage() {
  return <WorkspacePageRoute render={() => <DemoForm />} />;
}
