import * as React from 'react';

export const DATA_TABLE_PAGE_SIZE_OPTIONS = [10, 50, 200, 500, 2000] as const;
export const DEFAULT_DATA_TABLE_PAGE_SIZE = DATA_TABLE_PAGE_SIZE_OPTIONS[1];

const STORAGE_KEY = 'app-data-table-per-page';
const DATA_TABLE_PAGE_SIZE_OPTION_SET = new Set<number>(DATA_TABLE_PAGE_SIZE_OPTIONS);

function getStorageKey(tableId?: string): string {
  if (!tableId) {
    return STORAGE_KEY;
  }

  return `${STORAGE_KEY}:${tableId}`;
}

/**
 * Reads the user's preferred page size from localStorage.
 * Returns null when no preference has been saved or localStorage is unavailable.
 *
 * Contract: this function ONLY reads from localStorage. It does NOT read from
 * URL search params, router state, or any other source.
 */
export function readDataTablePageSize(tableId?: string): number | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(getStorageKey(tableId));
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return isValidDataTablePageSize(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persists the user's preferred page size to localStorage.
 *
 * Contract: this function ONLY writes to localStorage. It does NOT write to
 * URL search params, router state, or any other destination.
 */
export function writeDataTablePageSize(pageSize: number, tableId?: string): void {
  try {
    if (typeof window === 'undefined') return;
    const normalized = normalizeDataTablePageSize(pageSize);
    window.localStorage.setItem(getStorageKey(tableId), String(normalized));
  } catch {
    // write blocked — degrade silently
  }
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

type UseDataTablePageSizeOptions = {
  tableId?: string;
};

/**
 * Hook that resolves the current page size from the user's localStorage
 * preference, falling back to DEFAULT_DATA_TABLE_PAGE_SIZE.
 *
 * Contract:
 * - On mount: reads localStorage preference → seeds pageSize
 * - On pageSize change via setPageSize: writes back to localStorage
 * - Does NOT sync with URL search params (that's the caller's choice)
 * - Does NOT read router state
 */
export function useDataTablePageSize({
  tableId
}: UseDataTablePageSizeOptions = {}) {
  const [pageSize, setPageSizeState] = React.useState<number>(DEFAULT_DATA_TABLE_PAGE_SIZE);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const persistedPageSize = readDataTablePageSize(tableId);
    const nextPageSize = persistedPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE;

    setPageSizeState((currentPageSize) =>
      currentPageSize === nextPageSize ? currentPageSize : nextPageSize
    );

    if (persistedPageSize === null) {
      writeDataTablePageSize(nextPageSize, tableId);
    }

    setIsReady(true);
  }, [tableId]);

  const setPageSize = React.useCallback(
    (nextPageSize: number) => {
      const normalizedPageSize = normalizeDataTablePageSize(nextPageSize);

      setPageSizeState(normalizedPageSize);
      writeDataTablePageSize(normalizedPageSize, tableId);
    },
    [tableId]
  );

  return {
    isReady,
    pageSize,
    setPageSize
  };
}
