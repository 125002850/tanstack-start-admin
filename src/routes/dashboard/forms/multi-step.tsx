import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const FormsShowcasePage = lazyRouteComponent(
  () => import('@/features/forms/components/forms-showcase-page')
);

const meta = defineRouteMeta({
  label: '多步骤表单',
  title: '开发示例：多步骤表单',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 12,
    parentId: '/dashboard/forms',
    icon: 'forms'
  }
});

export const Route = createFileRoute('/dashboard/forms/multi-step')({
  ...meta,
  component: MultiStepFormPage
});

function MultiStepFormPage() {
  return <WorkspacePageRoute render={() => <FormsShowcasePage />} />;
}
