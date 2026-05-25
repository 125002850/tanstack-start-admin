import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { ProductPageCacheBindings } from '@/features/products/components/product-page-cache-bindings';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { PageCacheProvider } from '@/lib/page-cache';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '产品',
  title: '概览：产品管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 20,
    icon: 'product',
    shortcut: ['p', 'p'],
  },
});

const productSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  category: z.string().optional(),
  sort: z.string().optional()
});

export const Route = createFileRoute('/dashboard/product/')({
  ...meta,
  validateSearch: zodValidator(productSearchSchema),
  component: ProductPage,
});

function ProductPage() {
  return (
    <PageCacheProvider scope='dashboard.product.list'>
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
        <ProductPageCacheBindings />
      </PageContainer>
    </PageCacheProvider>
  );
}
