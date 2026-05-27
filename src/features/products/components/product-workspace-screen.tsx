import { Link } from '@tanstack/react-router'
import PageContainer from '@/components/layout/page-container'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import ProductListingPage from './product-listing'

export default function ProductWorkspaceScreen() {
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
      <ProductListingPage />
    </PageContainer>
  )
}
