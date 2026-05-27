import { createFileRoute } from '@tanstack/react-router'
import ProductWorkspaceScreen from '@/features/products/components/product-workspace-screen'
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary'
import { defineRouteMeta } from '@/lib/router/app-route-meta'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'

const meta = defineRouteMeta({
  label: '产品',
  title: '概览：产品管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 20,
    icon: 'product',
    shortcut: ['p', 'p']
  },
  workspace: {
    refreshPolicy: 'query-invalidate',
  },
})

export const Route = createFileRoute('/dashboard/product/')({
  ...meta,
  component: ProductPage
})

function ProductPage() {
  if (!isWorkspaceTabsEnabled()) {
    // flag‑off: render feature‑local state directly, no page‑cache wrapper
    return <ProductWorkspaceScreen />
  }

  return (
    <WorkspacePageBoundary
      tabId='/dashboard/product'
      initialTitle='产品'
      render={() => <ProductWorkspaceScreen />}
    />
  )
}
