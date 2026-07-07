import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { createPortal } from 'react-dom';

/**
 * DataTable 专用单例 Tooltip Provider。
 *
 * 单元格很多时，如果每个文本都各自挂一个 Radix Tooltip，会产生大量 DOM 和事件开销。
 * 这里通过一个隐藏的 ghost trigger 复用同一个 Tooltip Content，按 hover 的单元格移动位置。
 */
interface CellTooltipContextValue {
  showTooltip: (trigger: HTMLElement, content: string) => void;
  hideTooltip: (trigger?: HTMLElement, options?: { immediate?: boolean }) => void;
}

const CellTooltipContext = React.createContext<CellTooltipContextValue | null>(null);

/** 供文本单元格读取共享 tooltip 控制器；没有 Provider 时组件会自然退化为只截断。 */
export function useCellTooltip() {
  return React.useContext(CellTooltipContext);
}

export function DataTableCellTooltipProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState('');
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const activeTriggerRef = React.useRef<HTMLElement | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const closeTooltip = React.useCallback(() => {
    // 关闭时清空 activeTrigger，防止延迟 hide 误关掉后续 hover 的单元格。
    clearTimeout(hideTimerRef.current);
    activeTriggerRef.current = null;
    setOpen(false);
  }, []);

  const showTooltip = React.useCallback((trigger: HTMLElement, text: string) => {
    clearTimeout(hideTimerRef.current);

    const rect = trigger.getBoundingClientRect();
    const ghost = ghostRef.current;
    if (!ghost) return;

    // ghost trigger 的矩形模拟真实单元格文本位置，Radix 仍负责浮层定位和碰撞处理。
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;

    activeTriggerRef.current = trigger;
    setContent(text);
    setOpen(true);
  }, []);

  const hideTooltip = React.useCallback(
    (trigger?: HTMLElement, options?: { immediate?: boolean }) => {
      if (trigger && activeTriggerRef.current !== trigger) {
        // 延迟关闭期间如果用户移到了其他单元格，旧 trigger 不能关闭新 tooltip。
        return;
      }

      clearTimeout(hideTimerRef.current);

      if (options?.immediate) {
        closeTooltip();
        return;
      }

      hideTimerRef.current = setTimeout(() => {
        if (trigger && activeTriggerRef.current !== trigger) {
          return;
        }

        closeTooltip();
      }, 50);
    },
    [closeTooltip]
  );

  React.useEffect(() => {
    // 任意祖先滚动都会让 trigger 坐标失效，直接关闭最稳妥。
    const handleScroll = () => closeTooltip();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [closeTooltip]);

  React.useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current);
      activeTriggerRef.current = null;
    };
  }, []);

  const ctxValue = React.useMemo(() => ({ showTooltip, hideTooltip }), [showTooltip, hideTooltip]);

  return (
    <CellTooltipContext.Provider value={ctxValue}>
      <TooltipPrimitive.Provider>
        <TooltipPrimitive.Root
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              activeTriggerRef.current = null;
            }
            setOpen(nextOpen);
          }}
          delayDuration={0}
        >
          {typeof document === 'undefined'
            ? null
            : createPortal(
                // Radix Tooltip 需要 Trigger；这里用不可见 ghost 作为共享锚点。
                <TooltipPrimitive.Trigger asChild>
                  <div
                    ref={ghostRef}
                    className='fixed pointer-events-none invisible'
                    aria-hidden='true'
                  />
                </TooltipPrimitive.Trigger>,
                document.body
              )}
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              data-slot='data-table-cell-tooltip-content'
              side='top'
              sideOffset={4}
              className='bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance'
            >
              {content}
              <TooltipPrimitive.Arrow className='bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]' />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
      {children}
    </CellTooltipContext.Provider>
  );
}
