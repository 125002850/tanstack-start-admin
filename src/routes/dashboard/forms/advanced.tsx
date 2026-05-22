import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import AdvancedFormPatterns from '@/features/forms/components/advanced-form-patterns';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '高级模式',
  documentTitle: 'Dashboard: Advanced Form Patterns',
  nav: {
    visible: true,
    group: 'components',
    order: 14,
    parentId: '/dashboard/forms',
    icon: 'forms',
  },
});

export const Route = createFileRoute('/dashboard/forms/advanced')({
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => (
    <PageContainer
      pageTitle='Advanced Form Patterns'
      pageDescription='Linked fields, async validation, dynamic rows, nested objects, cross-field validation, and form-level errors.'
    >
      <AdvancedFormPatterns />
    </PageContainer>
  )
});
