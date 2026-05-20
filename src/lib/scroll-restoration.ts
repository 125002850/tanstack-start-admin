import type { ParsedLocation } from '@tanstack/react-router';

export const PRODUCT_LIST_PATH = '/dashboard/product';
export const PRODUCT_LIST_SCROLL_RESTORATION_ID = 'products-table';
export const PRODUCT_LIST_SCROLL_RESTORATION_SELECTOR = `[data-scroll-restoration-id="${PRODUCT_LIST_SCROLL_RESTORATION_ID}"]`;

const PAGE_STATE_STORAGE_KEY = 'app-page-state-restoration-v1';

type RestorableLocation = Pick<ParsedLocation, 'href' | 'pathname' | 'search' | 'searchStr'>;

type RestorablePageState = {
  href: string;
  pathname: string;
  search: ParsedLocation['search'];
  searchStr: string;
  updatedAt: number;
};

function normalizeScrollPathname(pathname: string) {
  if (pathname === '/') return pathname;

  return pathname.replace(/\/+$/, '');
}

function getSafeSessionStorage() {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage === 'object'
      ? window.sessionStorage
      : undefined;
  } catch {
    return undefined;
  }
}

function loadRestorablePageStateMap() {
  const safeSessionStorage = getSafeSessionStorage();

  if (!safeSessionStorage) {
    return new Map<string, RestorablePageState>();
  }

  try {
    const raw = safeSessionStorage.getItem(PAGE_STATE_STORAGE_KEY);

    if (!raw) {
      return new Map<string, RestorablePageState>();
    }

    const parsed = JSON.parse(raw) as Record<string, RestorablePageState>;
    return new Map<string, RestorablePageState>(Object.entries(parsed));
  } catch {
    return new Map<string, RestorablePageState>();
  }
}

const restorablePageStateMap = loadRestorablePageStateMap();

function persistRestorablePageStateMap() {
  const safeSessionStorage = getSafeSessionStorage();

  if (!safeSessionStorage) {
    return;
  }

  try {
    safeSessionStorage.setItem(
      PAGE_STATE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(restorablePageStateMap.entries()))
    );
  } catch {
    // Ignore session storage write failures.
  }
}

export function rememberPageState(location: RestorableLocation) {
  const pathname = normalizeScrollPathname(location.pathname);

  if (pathname !== PRODUCT_LIST_PATH) {
    return;
  }

  restorablePageStateMap.set(pathname, {
    href: location.href,
    pathname,
    search: location.search,
    searchStr: location.searchStr,
    updatedAt: Date.now()
  });

  persistRestorablePageStateMap();
}

export function getRestoredPageState(pathname: string) {
  return restorablePageStateMap.get(normalizeScrollPathname(pathname));
}

export function getProductListRestorationRedirectHref(
  location: Pick<ParsedLocation, 'href' | 'pathname' | 'search' | 'searchStr'>
) {
  const pathname = normalizeScrollPathname(location.pathname);

  if (pathname !== PRODUCT_LIST_PATH) {
    return undefined;
  }

  const savedState = getRestoredPageState(pathname);

  if (!savedState) {
    return undefined;
  }

  const hasExplicitSearch = location.searchStr.length > 0;
  const search = location.search as Record<string, unknown> | undefined;
  const isDefaultProductListSearch =
    search?.page === 1 &&
    search?.perPage === 10 &&
    search?.name === undefined &&
    search?.category === undefined &&
    search?.sort === undefined;

  if (
    hasExplicitSearch &&
    !isDefaultProductListSearch &&
    location.searchStr !== savedState.searchStr
  ) {
    return undefined;
  }

  if (savedState.href === location.href) {
    return undefined;
  }

  return savedState.href;
}

export function getAppScrollRestorationKey(location: ParsedLocation) {
  const normalizedPathname = normalizeScrollPathname(location.pathname);

  if (normalizedPathname === PRODUCT_LIST_PATH) {
    return `${normalizedPathname}${location.searchStr}`;
  }

  // oxlint-disable-next-line no-underscore-dangle
  return location.state.__TSR_key || location.href;
}
