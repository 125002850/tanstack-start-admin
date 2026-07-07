import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const AdvancedFormPatterns = lazyRouteComponent(
  () => import('@/features/forms/components/advanced-form-patterns')
);

const meta = defineRouteMeta({
  label: '高级模式',
  title: '开发示例：高级表单模式',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 14,
    parentId: '/dashboard/forms',
    icon: 'forms'
  }
});

export const Route = createFileRoute('/dashboard/forms/advanced')({
  ...meta,
  component: AdvancedFormPage
});

function AdvancedFormPage() {
  return <WorkspacePageRoute render={() => <AdvancedFormPatterns />} />;
}
