import { useMemo, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import type { WorkspaceScreenProps } from '@/features/workspace-tabs/types'
import { useBridgedSearchAdapter } from '@/features/workspace-tabs/hooks/use-bridged-search-adapter'
import PageContainer from '@/components/layout/page-container'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import ProductListingPage from './product-listing'
import type { ProductListState } from '../workspace/product-workspace-definition'
import {
  stateToProductFilters,
  setProductWorkspaceFilters,
} from '../workspace/product-workspace-definition'

export default function ProductWorkspaceScreen({
  state,
  updateState,
  definition,
}: WorkspaceScreenProps<ProductListState>) {
  const filters = useMemo(() => stateToProductFilters(state), [state])

  useEffect(() => {
    setProductWorkspaceFilters(filters)
  }, [filters])

  const adapter = useBridgedSearchAdapter(state, updateState, definition)

  return (
    <PageContainer
      pageHeaderAction={
        <Link
          to='/dashboard/product/$productId'
          params={{ productId: 'new' }}
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <Icons.add className='mr-2 h-4 w-4' /> 新增产品
        </Link>
      }
    >
      <ProductListingPage searchAdapter={adapter} />
    </PageContainer>
  )
}
