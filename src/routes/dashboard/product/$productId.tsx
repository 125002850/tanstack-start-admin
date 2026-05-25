import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import ProductViewPage from '@/features/products/components/product-view-page';
import { productByIdOptions } from '@/features/products/api/queries';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '产品详情',
  title: '控制台：产品详情',
  breadcrumb: { label: '产品详情' },
});

export const Route = createFileRoute('/dashboard/product/$productId')({
  ...meta,
  loader: async ({ context: { queryClient }, params }) => {
    if (params.productId !== 'new') {
      await queryClient.ensureQueryData(productByIdOptions(Number(params.productId)));
    }
  },
  component: ProductDetailPage
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <ProductViewPage productId={productId} />
      </div>
    </PageContainer>
  );
}
