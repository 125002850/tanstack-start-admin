import { emitDataTableVirtualEvent } from '@/components/ui/table/data-table-virtual-events';
import type { DataTableVirtualizationOptions } from '@/types/data-table';

export function resolveProductTableVirtualizationOptions(
  enabled: boolean,
  onVirtualizationFallback?: DataTableVirtualizationOptions['onVirtualizationFallback']
): DataTableVirtualizationOptions {
  if (!enabled) {
    const reason =
      typeof ResizeObserver === 'undefined' ? 'unsupported-browser' : 'disabled-by-config';

    emitDataTableVirtualEvent({ event: reason });
    onVirtualizationFallback?.(reason);
  }

  return {
    enabled,
    onVirtualizationFallback
  };
}
