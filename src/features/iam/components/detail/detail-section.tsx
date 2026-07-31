import * as React from 'react';

import { cn } from '@/lib/utils';

type DetailSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
} & React.ComponentProps<'details'>;

export function DetailSection({
  title,
  children,
  defaultOpen = true,
  className,
  ...props
}: DetailSectionProps) {
  return (
    <details
      data-slot='detail-section'
      open={defaultOpen}
      className={cn('group', className)}
      {...props}
    >
      <summary className='text-muted-foreground mb-3 flex cursor-pointer items-center gap-2 text-xs font-medium uppercase tracking-widest select-none hover:text-foreground'>
        <span className='bg-border inline-block h-px flex-1' />
        {title}
        <span className='bg-border inline-block h-px flex-1' />
      </summary>
      {children}
    </details>
  );
}
