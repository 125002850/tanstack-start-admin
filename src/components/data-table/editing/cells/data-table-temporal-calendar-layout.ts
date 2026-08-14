export const DATA_TABLE_TEMPORAL_CALENDAR_CLASS_NAMES = {
  months: 'relative flex w-full flex-col gap-2 sm:flex-row',
  month: 'flex w-full flex-col gap-4',
  nav: 'absolute inset-x-0 top-0 flex h-8 w-full items-center justify-between gap-1',
  month_caption: 'flex h-8 w-full items-center justify-center px-8',
  month_grid: 'w-full border-collapse',
  weekdays: 'grid w-full grid-cols-7',
  weekday: 'w-full rounded-md text-center text-[0.8rem] font-normal text-muted-foreground',
  week: 'mt-2 grid w-full grid-cols-7',
  day: 'relative flex justify-center p-0 text-center text-sm focus-within:relative focus-within:z-20',
  selected:
    '!bg-transparent [&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus-visible]:bg-primary [&>button:focus-visible]:text-primary-foreground [&>button:focus-visible]:!ring-0'
} as const;
