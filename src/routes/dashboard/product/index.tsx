import { createFileRoute } from '@tanstack/react-router'
import ProductScreen from '@/features/products/components/product-screen'
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary'
import { defineRouteMeta } from '@/lib/router/app-route-meta'

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
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/product'
      render={() => <ProductScreen />}
    />
  )
}
