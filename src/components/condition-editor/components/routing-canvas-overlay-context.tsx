import * as React from 'react';

type RoutingCanvasOverlayContextValue = {
  readonly activeOverlayId: string | null;
  readonly openOverlay: (id: string) => void;
  readonly closeOverlay: (id: string) => void;
};

const RoutingCanvasOverlayContext = React.createContext<RoutingCanvasOverlayContextValue | null>(
  null
);

export function RoutingCanvasOverlayProvider({ children }: { readonly children: React.ReactNode }) {
  const [activeOverlayId, setActiveOverlayId] = React.useState<string | null>(null);
  const openOverlay = React.useCallback((id: string) => setActiveOverlayId(id), []);
  const closeOverlay = React.useCallback(
    (id: string) => setActiveOverlayId((current) => (current === id ? null : current)),
    []
  );
  const value = React.useMemo(
    () => ({ activeOverlayId, openOverlay, closeOverlay }),
    [activeOverlayId, closeOverlay, openOverlay]
  );

  return (
    <RoutingCanvasOverlayContext.Provider value={value}>
      {children}
    </RoutingCanvasOverlayContext.Provider>
  );
}

export function useRoutingCanvasOverlayOpen(id: string) {
  const context = React.useContext(RoutingCanvasOverlayContext);
  const [localOpen, setLocalOpen] = React.useState(false);

  if (context === null) {
    const handleOpenChange = (nextOpen: boolean) => setLocalOpen(nextOpen);
    return { open: localOpen, onOpenChange: handleOpenChange };
  }

  const open = context.activeOverlayId === id;
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) context.openOverlay(id);
    else context.closeOverlay(id);
  };
  return { open, onOpenChange: handleOpenChange };
}
