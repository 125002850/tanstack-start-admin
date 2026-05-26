import { Suspense } from 'react';
import { ProductTable, ProductTableSkeleton } from './product-tables';
import type { DataTableSearchAdapter } from '@/features/workspace-tabs/types';

export default function ProductListingPage({
  searchAdapter,
}: {
  searchAdapter?: DataTableSearchAdapter;
}) {
  return (
    <Suspense fallback={<ProductTableSkeleton />}>
      <ProductTable searchAdapter={searchAdapter} />
    </Suspense>
  );
}
