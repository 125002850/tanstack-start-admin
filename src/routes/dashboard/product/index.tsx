import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { ProductPageCacheBindings } from '@/features/products/components/product-page-cache-bindings';
import { columns as productColumns } from '@/features/products/components/product-tables/columns';
import { DEFAULT_DATA_TABLE_PAGE_SIZE, isValidDataTablePageSize } from '@/lib/data-table-page-size';
import { parseSortingState } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { PageCacheProvider } from '@/lib/page-cache';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { PRODUCT_CATEGORIES } from '@/constants/product-categories';

const meta = defineRouteMeta({
  label: '产品',
  title: '概览：产品管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 20,
    icon: 'product',
    shortcut: ['p', 'p']
  }
});

const productColumnIds = productColumns.map((column) => column.id).filter(Boolean) as string[];

const productSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
  perPage: z.coerce
    .number()
    .int()
    .refine(isValidDataTablePageSize)
    .optional()
    .catch(DEFAULT_DATA_TABLE_PAGE_SIZE),
  name: z.string().trim().max(120).optional().catch(undefined),
  category: z.enum(PRODUCT_CATEGORIES).optional().catch(undefined),
  sort: z
    .string()
    .trim()
    .max(512)
    .optional()
    .catch(undefined)
    .transform((value) => {
      if (!value) return undefined;

      return parseSortingState(value, productColumnIds).length > 0 ? value : undefined;
    })
});

export const Route = createFileRoute('/dashboard/product/')({
  ...meta,
  validateSearch: zodValidator(productSearchSchema),
  beforeLoad: ({ buildLocation, location, search }) => {
    const normalizedLocation = buildLocation({
      to: location.pathname,
      search
    });

    if (normalizedLocation.href !== location.href) {
      throw redirect({
        to: location.pathname,
        search,
        replace: true
      });
    }
  },
  component: ProductPage
});

function ProductPage() {
  return (
    <PageCacheProvider scope='dashboard.product.list' persist={false}>
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
