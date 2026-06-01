import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import AdvancedFormPatterns from '@/features/forms/components/advanced-form-patterns';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '高级模式',
  title: 'Dashboard: Advanced Form Patterns',
  workspace: {},
  nav: {
    visible: true,
    group: 'components',
    order: 14,
    parentId: '/dashboard/forms',
    icon: 'forms'
  },
  page: {
    title: 'Advanced Form Patterns',
    description:
      'Linked fields, async validation, dynamic rows, nested objects, cross-field validation, and form-level errors.'
  }
});

export const Route = createFileRoute('/dashboard/forms/advanced')({
  ...meta,
  component: AdvancedFormPage
});

function AdvancedFormPage() {
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/forms/advanced'
      render={() => <AdvancedFormContent />}
    />
  );
}

function AdvancedFormContent() {
  return (
    <PageContainer>
      <AdvancedFormPatterns />
    </PageContainer>
  );
}
