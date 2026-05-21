import { useEffect, useMemo, useState } from 'react';
import type { ParsedLocation } from '@tanstack/react-router';
import { useCallbackRef } from '@/hooks/use-callback-ref';
import { type PageCacheSlotValue, usePageCacheSlot } from './use-page-cache-slot';

export type PageCacheSearchLocation<TSearch extends PageCacheSlotValue = PageCacheSlotValue> = Pick<
  ParsedLocation,
  'href' | 'pathname' | 'searchStr'
> & {
  search: TSearch;
};

export type PageCacheSearchSnapshot<TSearch extends PageCacheSlotValue = PageCacheSlotValue> =
  PageCacheSearchLocation<TSearch>;

export type UsePageCacheSearchOptions<TSearch extends PageCacheSlotValue = PageCacheSlotValue> = {
  slot?: string;
  location: PageCacheSearchLocation<TSearch>;
  shouldRestore: (current: PageCacheSearchLocation<TSearch>) => boolean;
  restore: (href: string) => void;
};

export type UsePageCacheSearchResult = {
  isReady: boolean;
  isRestoring: boolean;
};

const DEFAULT_SEARCH_SLOT = 'search';

export function usePageCacheSearch<TSearch extends PageCacheSlotValue = PageCacheSlotValue>({
  slot = DEFAULT_SEARCH_SLOT,
  location,
  shouldRestore,
  restore
}: UsePageCacheSearchOptions<TSearch>): UsePageCacheSearchResult {
  const [hasResolvedRestore, setHasResolvedRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingRestoreHref, setPendingRestoreHref] = useState<string | null>(null);
  const shouldRestoreRef = useCallbackRef(shouldRestore);
  const restoreRef = useCallbackRef(restore);
  const currentLocation = useMemo(
    () => ({
      href: location.href,
      pathname: location.pathname,
      search: location.search,
      searchStr: location.searchStr
    }),
    [location.href, location.pathname, location.search, location.searchStr]
  );

  const {
    cachedValue,
    isReady: isSlotReady,
    save
  } = usePageCacheSlot<PageCacheSearchSnapshot<TSearch>>({
    slot,
    readCurrent: () => currentLocation,
    restore: (snapshot) => {
      restoreRef(snapshot.href);
    }
  });

  useEffect(() => {
    if (!isSlotReady) return;
    if (hasResolvedRestore || pendingRestoreHref) return;

    if (!cachedValue) {
      setHasResolvedRestore(true);
      setIsRestoring(false);
      return;
    }

    if (cachedValue.href === currentLocation.href || !shouldRestoreRef(currentLocation)) {
      setHasResolvedRestore(true);
      setIsRestoring(false);
      return;
    }

    setPendingRestoreHref(cachedValue.href);
    setIsRestoring(true);
    restoreRef(cachedValue.href);
  }, [
    cachedValue,
    currentLocation,
    hasResolvedRestore,
    isSlotReady,
    pendingRestoreHref,
    restoreRef,
    shouldRestoreRef
  ]);

  useEffect(() => {
    if (!pendingRestoreHref) return;
    if (currentLocation.href !== pendingRestoreHref) return;

    setPendingRestoreHref(null);
    setHasResolvedRestore(true);
    setIsRestoring(false);
  }, [currentLocation.href, pendingRestoreHref]);

  useEffect(() => {
    if (!isSlotReady || !hasResolvedRestore || pendingRestoreHref) return;
    save();
  }, [
    currentLocation.href,
    currentLocation.pathname,
    currentLocation.search,
    currentLocation.searchStr,
    hasResolvedRestore,
    isSlotReady,
    pendingRestoreHref,
    save
  ]);

  return {
    isReady: isSlotReady && hasResolvedRestore && pendingRestoreHref === null && !isRestoring,
    isRestoring
  };
}
