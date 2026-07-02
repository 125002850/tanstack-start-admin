import * as React from 'react';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
      {children}
    </span>
  );
}

export function FieldValue({ children }: { children: React.ReactNode }) {
  return <span className='text-base font-medium tabular-nums'>{children}</span>;
}

export function FieldItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className='group flex flex-col gap-1 rounded-[10px] border border-transparent bg-muted/40 px-3 py-2.5 transition-all hover:border-border hover:bg-muted/70'>
      <FieldLabel>{label}</FieldLabel>
      <FieldValue>{value ?? '-'}</FieldValue>
    </div>
  );
}
