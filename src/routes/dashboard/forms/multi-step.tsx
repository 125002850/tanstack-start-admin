import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import FormsShowcasePage from '@/features/forms/components/forms-showcase-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '多步骤表单',
  title: 'Dashboard: Multi-Step Form',
  workspace: {},
  nav: {
    visible: true,
    group: 'components',
    order: 12,
    parentId: '/dashboard/forms',
    icon: 'forms'
  },
  page: {
    title: 'Multi-Step Form',
    description: 'Multi-step wizard form pattern.'
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
