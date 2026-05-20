import { createFileRoute, Link, redirect, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import ProductListingPage from '@/features/products/components/product-listing';
import { getProductListRestorationRedirectHref, rememberPageState } from '@/lib/scroll-restoration';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { productInfoContent } from '@/config/infoconfig';

const productSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  category: z.string().optional(),
  sort: z.string().optional()
});

export const Route = createFileRoute('/dashboard/product/')({
  head: () => ({ meta: [{ title: 'Dashboard: Products' }] }),
  beforeLoad: ({ location }) => {
    const restoredHref = getProductListRestorationRedirectHref(location);

    if (restoredHref) {
      throw redirect({ href: restoredHref, replace: true });
    }
  },
  validateSearch: zodValidator(productSearchSchema),
  component: ProductPage
});

function ProductPage() {
  const location = useLocation();

  useEffect(() => {
    rememberPageState(location);
  }, [location]);

  return (
    <PageContainer
      pageTitle='Products'
      pageDescription='Manage products (React Query + search params table pattern.)'
      infoContent={productInfoContent}
      pageHeaderAction={
        <Link
          to='/dashboard/product/$productId'
          params={{ productId: 'new' }}
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <Icons.add className='mr-2 h-4 w-4' /> Add New
        </Link>
      }
    >
      <ProductListingPage />
    </PageContainer>
  );
}
