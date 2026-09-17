import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** 原生 disabled 按钮不能接收焦点，由外层提供键盘可达的原因说明。 */
export function DataTableActionTooltip({
  label,
  disabled,
  reason,
  children
}: {
  label: string;
  disabled: boolean;
  reason?: string | null;
  children: ReactElement;
}) {
  const description = disabled
    ? `${label}：${reason?.trim() || '当前条件不满足，暂不可操作。'}`
    : label;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {disabled ? (
            <span
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 原生禁用按钮不可聚焦，此说明容器提供键盘读取禁用原因的入口。
              tabIndex={0}
              aria-label={description}
              className='inline-flex cursor-not-allowed rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&>button]:rounded-[inherit]'
              data-disabled-action
              data-row-expand-ignore
            >
              {children}
            </span>
          ) : (
            children
          )}
        </TooltipTrigger>
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
