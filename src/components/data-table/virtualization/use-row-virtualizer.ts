import { observeActiveElementOffset } from './observe-active-element-offset';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table';

import { emitDataTableVirtualEvent } from './data-table-virtual-events';
import type { DataTableResolvedVirtualizationOptions } from './types';

export function useRowVirtualizer({
  rows,
  resetKey,
  virtualization,
  scrollViewport
}: {
  rows: ReadonlyArray<{ id: string }>;
  resetKey: string;
  virtualization?: DataTableResolvedVirtualizationOptions;
  scrollViewport: HTMLDivElement | null;
}) {
  const rowCount = rows.length;
  const [runtimeFallback, setRuntimeFallback] = useState(false);
  const shouldVirtualize =
    typeof window !== 'undefined' &&
    virtualization?.enabled === true &&
    rowCount >= (virtualization.rowCountThreshold ?? DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold) &&
    !runtimeFallback;
  const estimateSize = useCallback(
    () => virtualization?.estimateRowHeight ?? DATA_TABLE_VIRTUAL_PRESET.estimateRowHeight,
    [virtualization?.estimateRowHeight]
  );
  const getItemKey = useCallback((index: number) => rows[index].id, [rows]);
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    observeElementOffset: observeActiveElementOffset,
    count: rowCount,
    getItemKey,
    getScrollElement: () => scrollViewport,
    estimateSize,
    overscan: virtualization?.overscan ?? DATA_TABLE_VIRTUAL_PRESET.overscan,
    enabled: shouldVirtualize
  });

  const previousEstimateSizeRef = useRef(estimateSize);
  useLayoutEffect(() => {
    if (!shouldVirtualize || !scrollViewport || previousEstimateSizeRef.current === estimateSize) {
      return;
    }
    // 固定行高仅在配置变化时失效；Activity 恢复和行数变化由 virtualizer 自行处理。
    previousEstimateSizeRef.current = estimateSize;
    virtualizer.measure();
  }, [estimateSize, scrollViewport, shouldVirtualize, virtualizer]);

  const previousResetKeyRef = useRef('');
  useLayoutEffect(() => {
    if (previousResetKeyRef.current && previousResetKeyRef.current !== resetKey) {
      virtualizer.scrollToIndex(0, { behavior: 'auto' });
    }
    previousResetKeyRef.current = resetKey;
  }, [resetKey, virtualizer]);

  const frozenRef = useRef(false);
  useLayoutEffect(() => {
    const element = scrollViewport;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) {
          if (!frozenRef.current) {
            frozenRef.current = true;
            emitDataTableVirtualEvent({ event: 'suspended-hidden' });
          }
        } else if (frozenRef.current) {
          frozenRef.current = false;
          emitDataTableVirtualEvent({ event: 'resumed-visible' });
        }
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollViewport, virtualizer]);

  const enabledEmittedRef = useRef(false);
  useEffect(() => {
    if (!shouldVirtualize || enabledEmittedRef.current) return;
    enabledEmittedRef.current = true;
    emitDataTableVirtualEvent({ event: 'enabled', count: rowCount });
  }, [rowCount, shouldVirtualize]);

  const handleRuntimeError = useCallback(() => {
    setRuntimeFallback(true);
    emitDataTableVirtualEvent({ event: 'runtime-error' });
    virtualization?.onVirtualizationFallback?.('runtime-error');
  }, [virtualization]);

  return { handleRuntimeError, shouldVirtualize, virtualizer };
}

export type DataTableRowVirtualizer = Virtualizer<HTMLDivElement, HTMLTableRowElement>;
