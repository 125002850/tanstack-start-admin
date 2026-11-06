import type { Ref } from 'react';
import { Icons } from '@/components/icons';
import { CanvasToolbarButton } from './canvas-toolbar';

interface CanvasExpandButtonProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
  expandLabel?: string;
  collapseLabel?: string;
}

export function CanvasExpandButton({
  expanded,
  onExpandedChange,
  ref,
  expandLabel = '全屏查看画布',
  collapseLabel = '退出全屏'
}: CanvasExpandButtonProps) {
  const label = expanded ? collapseLabel : expandLabel;
  return (
    <CanvasToolbarButton
      label={label}
      aria-expanded={expanded}
      onClick={() => onExpandedChange(!expanded)}
      ref={ref}
    >
      {expanded ? <Icons.minimize className='size-4' /> : <Icons.maximize className='size-4' />}
    </CanvasToolbarButton>
  );
}
