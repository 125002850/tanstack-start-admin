import { createFileRoute } from '@tanstack/react-router'
import PageContainer from '@/components/layout/page-container'
import UserListingPage from '@/features/users/components/user-listing'
import UsersWorkspaceScreen from '@/features/users/components/users-workspace-screen'
import { usersInfoContent } from '@/features/users/info-content'
import { UserFormSheetTrigger } from '@/features/users/components/user-form-sheet'
import { defineRouteMeta } from '@/lib/router/app-route-meta'
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'

const meta = defineRouteMeta({
  label: '用户',
  title: '概览: 用户管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 30,
    icon: 'teams',
    shortcut: ['u', 'u']
  },
  page: {
    title: 'Users',
    description: 'Manage users with React Query and feature-local table state.',
    infoContent: usersInfoContent
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
})

export const Route = createFileRoute('/dashboard/users')({
  ...meta,
  component: UsersPage
})

function UsersPage() {
  if (!isWorkspaceTabsEnabled()) {
    return (
      <PageContainer pageHeaderAction={<UserFormSheetTrigger />}>
        <UserListingPage />
      </PageContainer>
    )
  }

  return (
    <WorkspacePageBoundary
      tabId='/dashboard/users'
      initialTitle='用户'
      render={() => <UsersWorkspaceScreen />}
    />
  )
}
