import { useContext } from 'react';
import { PageCacheContext } from './provider';

export function usePageCache() {
  const ctx = useContext(PageCacheContext);
  if (!ctx) {
    throw new Error('usePageCache must be used within a <PageCacheProvider>');
  }
  return ctx;
}
