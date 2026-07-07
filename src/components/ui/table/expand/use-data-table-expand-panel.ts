import * as React from 'react';

import { getAvailableExpandTabs } from '@/components/ui/table/expand/data-table-expand-panel';
import {
  DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING,
  DATA_TABLE_EXPAND_KEYBOARD_STEP_PX,
  resolveExpandSplitLayout
} from '@/lib/data-table-expand-split';
import type { ExpandConfigEdge } from '@/types/data-table';

const FALLBACK_EXPAND_HOST_HEIGHT = 800;

function resolveExpandActiveTabId<TData>(
  expandConfig: ExpandConfigEdge<TData>,
  row: TData,
  activeTab: string | null
) {
  const availableTabs = getAvailableExpandTabs(expandConfig, row);

  if (availableTabs.length === 0) {
    return null;
  }

  if (activeTab && availableTabs.some((tab) => tab.id === activeTab)) {
    return activeTab;
  }

  if (expandConfig.defaultTab && availableTabs.some((tab) => tab.id === expandConfig.defaultTab)) {
    return expandConfig.defaultTab;
  }

  return availableTabs[0]?.id ?? null;
}

export function useDataTableExpandPanel<TData>({
  expandConfig,
  expandedRow,
  expandedRowKey,
  isExpanded,
  onExpandedRowKeyChange
}: {
  expandConfig?: ExpandConfigEdge<TData>;
  expandedRow?: TData | null;
  expandedRowKey?: string | null;
  isExpanded: boolean;
  onExpandedRowKeyChange?: (rowKey: string | null) => void;
}) {
  const expandHostRef = React.useRef<HTMLDivElement>(null);
  const topPanelRef = React.useRef<HTMLDivElement>(null);
  const paginationRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{
    startY: number;
    startTopPx: number;
    minTopPx: number;
    maxTopPx: number;
    topPanel: HTMLDivElement;
  } | null>(null);
  const [requestedSplitTopPx, setRequestedSplitTopPx] = React.useState<number | null>(null);
  const [activeExpandTab, setActiveExpandTab] = React.useState<string | null>(null);
  const [expandHostHeight, setExpandHostHeight] = React.useState(FALLBACK_EXPAND_HOST_HEIGHT);
  const [expandOverheadPx, setExpandOverheadPx] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const expandTableSizing = expandConfig?.tableSizing ?? DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING;
  const expandSplitLayout = React.useMemo(
    () =>
      isExpanded
        ? resolveExpandSplitLayout({
            hostHeight: expandHostHeight,
            requestedTopPx: requestedSplitTopPx,
            overheadPx: expandOverheadPx,
            initialTopPx: expandTableSizing.initialHeight,
            minTopPx: expandTableSizing.minHeight,
            maxTopPx: expandTableSizing.maxHeight
          })
        : null,
    [expandHostHeight, expandOverheadPx, expandTableSizing, isExpanded, requestedSplitTopPx]
  );

  const getExpandRowKey = React.useCallback(
    (row: TData) => {
      if (!expandConfig) {
        return null;
      }

      const value = row[expandConfig.rowKey];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
    },
    [expandConfig]
  );

  React.useEffect(() => {
    if (!expandConfig || !expandedRow) {
      setActiveExpandTab(null);
      return;
    }

    setActiveExpandTab((current) => resolveExpandActiveTabId(expandConfig, expandedRow, current));
  }, [expandConfig, expandedRow, expandedRowKey]);

  React.useLayoutEffect(() => {
    if (!isExpanded) {
      return;
    }

    const hostElement = expandHostRef.current;
    if (!hostElement) {
      return;
    }

    const measure = () => {
      const nextHeight =
        Math.round(hostElement.getBoundingClientRect().height) ||
        hostElement.clientHeight ||
        FALLBACK_EXPAND_HOST_HEIGHT;

      setExpandHostHeight((current) => (current === nextHeight ? current : nextHeight));

      const paginationEl = paginationRef.current;
      if (paginationEl) {
        const paginationHeight = Math.round(paginationEl.getBoundingClientRect().height);
        setExpandOverheadPx((current) =>
          current === paginationHeight ? current : paginationHeight
        );
      }
    };

    measure();
    window.addEventListener('resize', measure);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(hostElement);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isExpanded]);

  React.useEffect(() => {
    if (!expandSplitLayout) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      const clampedTopPx = Math.min(
        Math.max(dragState.startTopPx + deltaY, dragState.minTopPx),
        dragState.maxTopPx
      );

      dragState.topPanel.style.flex = 'none';
      dragState.topPanel.style.height = `${clampedTopPx}px`;
    };

    const handlePointerUp = () => {
      const dragState = dragStateRef.current;
      if (dragState) {
        setRequestedSplitTopPx(parseInt(dragState.topPanel.style.height, 10));
      }
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [expandSplitLayout]);

  const handleExpandPanelClose = React.useCallback(() => {
    onExpandedRowKeyChange?.(null);
    setActiveExpandTab(null);
  }, [onExpandedRowKeyChange]);

  const handleSplitKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!expandSplitLayout || !expandSplitLayout.dragEnabled) {
        return;
      }

      let nextTopPx: number | null = null;

      switch (event.key) {
        case 'ArrowUp':
          nextTopPx = expandSplitLayout.topPx - DATA_TABLE_EXPAND_KEYBOARD_STEP_PX;
          break;
        case 'ArrowDown':
          nextTopPx = expandSplitLayout.topPx + DATA_TABLE_EXPAND_KEYBOARD_STEP_PX;
          break;
        case 'Home':
          nextTopPx = expandSplitLayout.minTopPx;
          break;
        case 'End':
          nextTopPx = expandSplitLayout.maxTopPx;
          break;
        default:
          break;
      }

      if (nextTopPx === null) {
        return;
      }

      event.preventDefault();
      setRequestedSplitTopPx(
        Math.min(Math.max(nextTopPx, expandSplitLayout.minTopPx), expandSplitLayout.maxTopPx)
      );
    },
    [expandSplitLayout]
  );

  const handleSplitPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!expandSplitLayout?.dragEnabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const topEl = topPanelRef.current;
      if (!topEl) return;

      setIsDragging(true);
      dragStateRef.current = {
        startY: event.clientY,
        startTopPx: topEl.getBoundingClientRect().height,
        minTopPx: expandSplitLayout.minTopPx,
        maxTopPx: expandSplitLayout.maxTopPx,
        topPanel: topEl
      };
    },
    [expandSplitLayout]
  );

  return {
    activeExpandTab,
    expandHostRef,
    expandSplitLayout,
    getExpandRowKey,
    handleExpandPanelClose,
    handleSplitKeyDown,
    handleSplitPointerDown,
    isDragging,
    paginationRef,
    setActiveExpandTab,
    topPanelRef
  };
}
