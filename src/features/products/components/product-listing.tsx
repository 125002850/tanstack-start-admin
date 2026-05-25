import { Suspense } from 'react';
import { ProductTable, ProductTableSkeleton } from './product-tables';

export default function ProductListingPage() {
  return (
    <Suspense fallback={<ProductTableSkeleton />}>
      <ProductTable />
    </Suspense>
  );
}
