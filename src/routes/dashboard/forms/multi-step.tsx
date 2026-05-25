import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import FormsShowcasePage from '@/features/forms/components/forms-showcase-page';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '多步骤表单',
  documentTitle: 'Dashboard: Multi-Step Form',
  nav: {
    visible: true,
    group: 'components',
    order: 12,
    parentId: '/dashboard/forms',
    icon: 'forms',
  },
  page: {
    title: 'Multi-Step Form',
    description: 'Multi-step wizard form pattern.',
  },
});

export const Route = createFileRoute('/dashboard/forms/multi-step')({
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => (
    <PageContainer>
      <FormsShowcasePage />
    </PageContainer>
  )
});
