import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import SheetFormDemo from '@/features/forms/components/sheet-form-demo';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '抽屉与弹窗',
  documentTitle: 'Dashboard: Sheet Form',
  nav: {
    visible: true,
    group: 'components',
    order: 13,
    parentId: '/dashboard/forms',
    icon: 'forms',
  },
  page: {
    title: 'Sheet & Dialog Forms',
    description: 'Form patterns inside sheets and dialogs with external submit buttons.',
  },
});

export const Route = createFileRoute('/dashboard/forms/sheet-form')({
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => (
    <PageContainer>
      <SheetFormDemo />
    </PageContainer>
  )
});
