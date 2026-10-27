import * as React from 'react';

import {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  normalizeDataTablePageSize,
  readDataTablePageSize,
  writeDataTablePageSize
} from '@/lib/data-table/state-persistence';

type UseDataTablePageSizeOptions = {
  tableId?: string;
};

/**
 * 将每页条数与表格维度的 localStorage 偏好同步。
 *
 * URL / Router 查询参数同步由调用方负责；这个 hook 只管理本地偏好和初始 ready 状态。
 */
export function useDataTablePageSize({ tableId }: UseDataTablePageSizeOptions = {}) {
  // 首次渲染就恢复偏好，让表格 pagination 与首个查询使用相同的页长。
  const [pageSize, setPageSizeState] = React.useState<number>(
    () => readDataTablePageSize(tableId) ?? DEFAULT_DATA_TABLE_PAGE_SIZE
  );
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    // 挂载或 tableId 改变时同步缓存；没有缓存时写入默认值。
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
      // 所有写入都先 normalize，避免非法 pageSize 进入持久化。
      const normalizedPageSize = normalizeDataTablePageSize(nextPageSize);
      setPageSizeState(normalizedPageSize);
      writeDataTablePageSize(normalizedPageSize, tableId);
    },
    [tableId]
  );

  return { isReady, pageSize, setPageSize };
}
