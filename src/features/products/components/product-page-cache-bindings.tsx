import { useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import ProductListingPage from './product-listing';
import { usePageCacheSearch } from '@/lib/page-cache';

type ProductPageSearch = {
  page: number;
  perPage: number;
  name?: string | undefined;
  category?: string | undefined;
  sort?: string | undefined;
};

const PRODUCT_DEFAULT_PAGE = 1;
const PRODUCT_DEFAULT_PER_PAGE = 10;

function normalizeProductSearch(search: Record<string, unknown>): ProductPageSearch {
  return {
    page: typeof search.page === 'number' ? search.page : PRODUCT_DEFAULT_PAGE,
    perPage: typeof search.perPage === 'number' ? search.perPage : PRODUCT_DEFAULT_PER_PAGE,
    name: typeof search.name === 'string' ? search.name : undefined,
    category: typeof search.category === 'string' ? search.category : undefined,
    sort: typeof search.sort === 'string' ? search.sort : undefined
  };
}

function isDefaultProductSearch(search: ProductPageSearch) {
  return (
    search.page === PRODUCT_DEFAULT_PAGE &&
    search.perPage === PRODUCT_DEFAULT_PER_PAGE &&
    search.name === undefined &&
    search.category === undefined &&
    search.sort === undefined
  );
}

function ProductPageCacheFallback({ isRestoring }: { isRestoring: boolean }) {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <p className='text-muted-foreground text-sm'>
        {isRestoring ? '正在恢复已缓存的产品筛选条件...' : '正在准备产品筛选条件...'}
      </p>
      <div className='flex animate-pulse flex-col gap-4'>
        <div className='bg-muted h-10 w-full rounded' />
        <div className='bg-muted h-96 w-full rounded-lg' />
        <div className='bg-muted h-10 w-full rounded' />
      </div>
    </div>
  );
}

export function ProductPageCacheBindings() {
  const location = useLocation();
  const navigate = useNavigate();
  const productSearch = useMemo(
    () => normalizeProductSearch(location.search as Record<string, unknown>),
    [location.search]
  );

  const { isReady, isRestoring } = usePageCacheSearch<ProductPageSearch>({
    location: {
      href: location.href,
      pathname: location.pathname,
      search: productSearch,
      searchStr: location.searchStr
    },
    shouldRestore: (current) => {
      return current.searchStr.length === 0 || isDefaultProductSearch(current.search);
    },
    restore: (href) => {
      void navigate({ href, replace: true });
    }
  });

  if (!isReady) {
    return <ProductPageCacheFallback isRestoring={isRestoring} />;
  }

  return <ProductListingPage />;
}
