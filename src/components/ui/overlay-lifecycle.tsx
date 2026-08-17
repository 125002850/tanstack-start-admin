import * as React from 'react';

type OverlayClose = () => void;

export type OverlayLifecycleRegistrar = (close: OverlayClose) => () => void;

const OverlayLifecycleContext = React.createContext<OverlayLifecycleRegistrar | null>(null);

export function OverlayLifecycleProvider({
  children,
  registerOverlay
}: {
  children: React.ReactNode;
  registerOverlay: OverlayLifecycleRegistrar;
}) {
  return (
    <OverlayLifecycleContext.Provider value={registerOverlay}>
      {children}
    </OverlayLifecycleContext.Provider>
  );
}

/**
 * 声明当前组件拥有一个受控浮层，并在宿主提供生命周期能力时注册关闭回调。
 * 未提供 OverlayLifecycleProvider 时保持 no-op，基础 UI 无需感知具体宿主。
 */
export function useOverlayLifecycle(isOpen: boolean, close: OverlayClose) {
  const registerOverlay = React.useContext(OverlayLifecycleContext);

  React.useEffect(() => {
    if (!isOpen || !registerOverlay) return;
    return registerOverlay(close);
  }, [close, isOpen, registerOverlay]);
}
