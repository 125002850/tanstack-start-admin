import { cn } from '@/lib/utils';

export function CalendarLegend({ viewBasis, dirty }: { viewBasis: string; dirty: boolean }) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm'>
      <div className='flex flex-wrap gap-3' aria-label='工作日历图例'>
        <LegendItem
          mark='工'
          label='工作日'
          className='bg-background text-foreground hover:text-foreground'
        />
        <LegendItem mark='休' label='周末' className='bg-muted/55 text-muted-foreground' />
        <LegendItem
          mark='假'
          label='法定节假日'
          className='bg-destructive/10 text-destructive dark:bg-destructive/15'
        />
        <LegendItem
          mark='班'
          label='调休工作日'
          className='bg-accent text-accent-foreground ring-1 ring-border'
        />
        <LegendItem
          mark='休'
          label='其他非工作日'
          className='bg-secondary text-secondary-foreground'
        />
      </div>
      <p className='text-muted-foreground'>
        当前网格：{viewBasis}
        {dirty ? '；虚线日期为待保存局部修改' : ''}
      </p>
    </div>
  );
}

function LegendItem({
  mark,
  label,
  className
}: {
  mark: string;
  label: string;
  className: string;
}) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className={cn('flex size-6 items-center justify-center rounded text-[9px]', className)}>
        {mark}
      </span>
      {label}
    </span>
  );
}
