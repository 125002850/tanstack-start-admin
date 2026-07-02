import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

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
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/forms/multi-step'
      render={() => <MultiStepFormContent />}
    />
  );
}

function MultiStepFormContent() {
  return (
    <PageContainer>
      <FormsShowcasePage />
    </PageContainer>
  );
}
