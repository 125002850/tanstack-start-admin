import * as React from 'react';

export const DATA_TABLE_PAGE_SIZE_OPTIONS = [10, 50, 100, 500, 2000] as const;
export const DEFAULT_DATA_TABLE_PAGE_SIZE = DATA_TABLE_PAGE_SIZE_OPTIONS[0];

const STORAGE_KEY = 'app-data-table-per-page';
const DATA_TABLE_PAGE_SIZE_OPTION_SET = new Set<number>(DATA_TABLE_PAGE_SIZE_OPTIONS);

function getSafeLocalStorage(): Storage | undefined {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage === 'object') {
      return window.localStorage;
    }
  } catch {
    // localStorage unavailable
  }

  return undefined;
}

export function isValidDataTablePageSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    DATA_TABLE_PAGE_SIZE_OPTION_SET.has(value)
  );
}

function normalizeDataTablePageSize(
  value: unknown,
  fallback = DEFAULT_DATA_TABLE_PAGE_SIZE
): number {
  return isValidDataTablePageSize(value) ? value : fallback;
}

export function readDataTablePageSize(): number | null {
  const storage = getSafeLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = Number.parseInt(raw, 10);
    return isValidDataTablePageSize(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDataTablePageSize(pageSize: number): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, String(normalizeDataTablePageSize(pageSize)));
  } catch {
    // write blocked — degrade silently
  }
}

type UseDataTablePageSizeOptions = {
  searchPerPage?: number;
  hasExplicitSearchPerPage?: boolean;
};

export function useDataTablePageSize({
  searchPerPage,
  hasExplicitSearchPerPage = typeof searchPerPage === 'number'
}: UseDataTablePageSizeOptions = {}) {
  const [pageSize, setPageSizeState] = React.useState(() =>
    hasExplicitSearchPerPage
      ? normalizeDataTablePageSize(searchPerPage)
      : DEFAULT_DATA_TABLE_PAGE_SIZE
  );
  const [isReady, setIsReady] = React.useState(hasExplicitSearchPerPage);

  React.useEffect(() => {
    if (hasExplicitSearchPerPage) {
      const normalizedSearchPageSize = normalizeDataTablePageSize(searchPerPage);

      setPageSizeState(normalizedSearchPageSize);
      setIsReady(true);
      writeDataTablePageSize(normalizedSearchPageSize);
      return;
    }

    const persistedPageSize = readDataTablePageSize();
    const nextPageSize = persistedPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE;

    setPageSizeState((currentPageSize) =>
      currentPageSize === nextPageSize ? currentPageSize : nextPageSize
    );

    if (persistedPageSize === null) {
      writeDataTablePageSize(nextPageSize);
    }

    setIsReady(true);
  }, [hasExplicitSearchPerPage, searchPerPage]);

  const setPageSize = React.useCallback((nextPageSize: number) => {
    const normalizedPageSize = normalizeDataTablePageSize(nextPageSize);

    setPageSizeState(normalizedPageSize);
    writeDataTablePageSize(normalizedPageSize);
  }, []);

  return {
    isReady,
    pageSize,
    setPageSize
  };
}
