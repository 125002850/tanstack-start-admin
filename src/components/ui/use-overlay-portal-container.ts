import * as React from 'react';

const DEFAULT_OVERLAY_CONTAINER_SELECTOR =
  '[data-slot="sheet-content"], [data-slot="dialog-content"], [role="dialog"]';

export function useOverlayPortalContainer<TElement extends HTMLElement>(
  selector = DEFAULT_OVERLAY_CONTAINER_SELECTOR
) {
  const triggerRef = React.useRef<TElement | null>(null);
  const [container, setContainer] = React.useState<HTMLElement | undefined>(undefined);

  const resolveContainer = React.useCallback(
    () => triggerRef.current?.closest<HTMLElement>(selector) ?? undefined,
    [selector]
  );

  const setTriggerNode = React.useCallback(
    (node: TElement | null) => {
      triggerRef.current = node;
      const nextContainer = node?.closest<HTMLElement>(selector) ?? undefined;
      setContainer(nextContainer);
    },
    [selector]
  );

  return {
    container,
    getContainer: resolveContainer,
    setTriggerNode,
    triggerRef
  };
}
