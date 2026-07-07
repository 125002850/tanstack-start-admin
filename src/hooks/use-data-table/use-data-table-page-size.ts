import * as React from 'react';

import {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  normalizeDataTablePageSize,
  readDataTablePageSize,
  writeDataTablePageSize
} from '@/lib/data-table-state-persistence';

type UseDataTablePageSizeOptions = {
  tableId?: string;
};

/**
 * Keeps the table page size synchronized with the table-scoped localStorage
 * preference. URL/router sync is intentionally owned by callers.
 */
export function useDataTablePageSize({ tableId }: UseDataTablePageSizeOptions = {}) {
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

  return { isReady, pageSize, setPageSize };
}
