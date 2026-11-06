import { useRef, useState, type ComponentProps } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { cn } from '@/lib/utils';

const MIN_REFRESH_FEEDBACK_MS = 400;

type RefreshButtonProps = Omit<
  ComponentProps<typeof Button>,
  'aria-busy' | 'aria-label' | 'asChild' | 'children' | 'isLoading' | 'onClick' | 'type'
> & {
  label?: string;
  /** 返回覆盖本次全部刷新请求的 Promise；错误由调用方的现有错误出口展示。 */
  onRefresh: () => Promise<unknown>;
};

export function RefreshButton({
  label = '刷新',
  onRefresh,
  disabled,
  size = 'icon',
  variant = 'ghost',
  ...props
}: RefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const { container, setTriggerNode } = useOverlayPortalContainer<HTMLSpanElement>();

  async function refresh() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    // 极快的响应也保留可感知的反馈；慢请求不会额外增加等待时间。
    const feedbackFinished = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MIN_REFRESH_FEEDBACK_MS);
    });
    try {
      await onRefresh();
    } catch {
      // Query、Mutation 或调用方的局部错误状态负责展示错误，按钮只恢复交互。
    } finally {
      await feedbackFinished;
      inFlight.current = false;
      setRefreshing(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex shrink-0' ref={setTriggerNode}>
          <Button
            {...props}
            aria-label={label}
            aria-busy={refreshing}
            disabled={disabled || refreshing}
            onClick={refresh}
            size={size}
            type='button'
            variant={variant}
          >
            <Icons.rotateClockwise
              aria-hidden='true'
              className={cn('size-4', refreshing && 'animate-spin motion-reduce:animate-none')}
            />
            {size === 'icon' ? null : label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent container={container}>{refreshing ? '正在刷新…' : label}</TooltipContent>
    </Tooltip>
  );
}
