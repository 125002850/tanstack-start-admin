import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { useOverlayLifecycle } from './overlay-lifecycle';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { useOverlayPortalContainer } from './use-overlay-portal-container';

/** 只解释禁用原因；实际控件的 disabled 仍由调用方设置。 */
export function DisabledTooltip({
  disabled,
  reason,
  children
}: {
  disabled: boolean;
  reason?: string;
  children: ReactElement;
}) {
  const description = reason?.trim();
  const enabled = disabled && Boolean(description);
  const [open, setOpen] = useState(false);
  const { container, setTriggerNode } = useOverlayPortalContainer<HTMLSpanElement>();
  const close = useCallback(() => setOpen(false), []);

  useOverlayLifecycle(enabled && open, close);

  useEffect(() => {
    setOpen(false);
  }, [disabled, description]);

  return (
    <Tooltip open={enabled && open} onOpenChange={(nextOpen) => setOpen(enabled && nextOpen)}>
      <TooltipTrigger asChild>
        <span
          ref={setTriggerNode}
          role={enabled ? 'group' : undefined}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 禁用控件不可聚焦，由外层提供键盘读取原因的入口。
          tabIndex={enabled ? 0 : undefined}
          aria-label={enabled ? description : undefined}
          className={cn(
            'inline-flex min-w-0',
            enabled &&
              'cursor-not-allowed rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&>*]:pointer-events-none'
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent container={container} className='max-w-80 whitespace-normal break-words'>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
