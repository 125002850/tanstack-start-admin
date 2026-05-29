import { createFileRoute } from '@tanstack/react-router';
import ChatViewPage from '@/features/chat/components/chat-view-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '聊天',
  title: 'Dashboard: Chat',
  workspace: {},
  nav: {
    visible: true,
    group: 'overview',
    order: 50,
    icon: 'chat',
    shortcut: ['c', 'c'],
  },
});

export const Route = createFileRoute('/dashboard/chat')({
  ...meta,
  component: ChatPage
});

function ChatPage() {
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/chat'
      render={() => <ChatViewPage />}
    />
  )
}
