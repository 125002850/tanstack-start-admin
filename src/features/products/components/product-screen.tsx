import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { ProductTable, ProductTableSkeleton } from './product-tables';

export default function ProductScreen() {
  return (
    <PageContainer>
      <Suspense fallback={<ProductTableSkeleton />}>
        <ProductTable />
      </Suspense>
    </PageContainer>
  );
}
