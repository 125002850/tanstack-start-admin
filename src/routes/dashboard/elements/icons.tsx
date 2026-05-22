import { createFileRoute } from '@tanstack/react-router';
import IconsViewPage from '@/features/elements/components/icons-view-page';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '图标',
  documentTitle: 'Dashboard : Icons',
  nav: {
    visible: true,
    group: 'components',
    order: 30,
    icon: 'palette',
  },
});

export const Route = createFileRoute('/dashboard/elements/icons')({
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => <IconsViewPage />
});
