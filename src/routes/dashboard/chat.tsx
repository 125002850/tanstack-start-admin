import { createFileRoute } from '@tanstack/react-router';
import ChatViewPage from '@/features/chat/components/chat-view-page';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '聊天',
  documentTitle: 'Dashboard: Chat',
  nav: {
    visible: true,
    group: 'overview',
    order: 50,
    icon: 'chat',
    shortcut: ['c', 'c'],
  },
});

export const Route = createFileRoute('/dashboard/chat')({
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => <ChatViewPage />
});
