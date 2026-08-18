import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table';

import { emitDataTableVirtualEvent } from './data-table-virtual-events';
import type { DataTableResolvedVirtualizationOptions } from './types';

export function useRowVirtualizer({
  rowCount,
  resetKey,
  virtualization,
  scrollViewportRef
}: {
  rowCount: number;
  resetKey: string;
  virtualization?: DataTableResolvedVirtualizationOptions;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
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
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rowCount,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize,
    overscan: virtualization?.overscan ?? DATA_TABLE_VIRTUAL_PRESET.overscan,
    enabled: shouldVirtualize
  });

  useLayoutEffect(() => {
    if (shouldVirtualize && scrollViewportRef.current && rowCount > 0) virtualizer.measure();
  }, [rowCount, scrollViewportRef, shouldVirtualize, virtualizer]);

  const previousResetKeyRef = useRef('');
  useLayoutEffect(() => {
    if (previousResetKeyRef.current && previousResetKeyRef.current !== resetKey) {
      virtualizer.scrollToIndex(0, { behavior: 'auto' });
    }
    previousResetKeyRef.current = resetKey;
  }, [resetKey, virtualizer]);

  const frozenRef = useRef(false);
  useLayoutEffect(() => {
    const element = scrollViewportRef.current;
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
          virtualizer.measure();
        }
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollViewportRef, virtualizer]);

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
