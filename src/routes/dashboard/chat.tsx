import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const ChatViewPage = lazyRouteComponent(() => import('@/features/chat/components/chat-view-page'));

const meta = defineRouteMeta({
  label: '聊天',
  title: '开发示例：聊天',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 30,
    icon: 'chat',
    shortcut: ['c', 'c']
  }
});

export const Route = createFileRoute('/dashboard/chat')({
  ...meta,
  component: ChatPage
});

function ChatPage() {
  return <WorkspacePageBoundary tabId='/dashboard/chat' render={() => <ChatViewPage />} />;
}
