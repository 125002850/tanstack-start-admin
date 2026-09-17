import * as React from 'react';
import { isTextOverflowing } from '@/hooks/use-text-overflow';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/** 保留触发元素的布局与焦点；调用方标记需要测量的文本节点。 */
export function OverflowTooltip({
  children,
  content,
  disabled = false
}: {
  children: React.ReactElement;
  content: React.ReactNode;
  disabled?: boolean;
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [disabled, content]);

  return (
    <Tooltip
      open={!disabled && open}
      onOpenChange={(nextOpen) => {
        const texts = triggerRef.current?.querySelectorAll<HTMLElement>(
          '[data-overflow-tooltip-text]'
        );
        setOpen(
          nextOpen &&
            !disabled &&
            Boolean(texts && Array.from(texts).some((text) => isTextOverflowing(text)))
        );
      }}
    >
      <TooltipTrigger asChild ref={triggerRef}>
        {children}
      </TooltipTrigger>
      <TooltipContent className='max-w-80 whitespace-normal break-words'>{content}</TooltipContent>
    </Tooltip>
  );
}
