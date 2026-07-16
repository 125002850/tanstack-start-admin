import * as React from 'react';

import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || '?'
  );
}

type DetailProfileCardProps = {
  name: string;
  subtitle?: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const avatarColors = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
];

function getAvatarColor(name: string): string {
  return avatarColors[hashCode(name) % avatarColors.length];
}

export function DetailProfileCard({ name, subtitle, status, children }: DetailProfileCardProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);

  return (
    <div
      data-slot='detail-profile-card'
      className='-mx-6 -mt-4 mb-4 flex flex-col gap-4 bg-linear-to-b from-muted/50 to-transparent px-6 pb-6 pt-8'
    >
      <div className='flex items-center gap-4'>
        <div
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold tracking-wide',
            colorClass
          )}
        >
          {initials}
        </div>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <h2 className='truncate text-xl font-semibold tracking-tight'>{name}</h2>
            {status}
          </div>
          {subtitle && <p className='text-muted-foreground truncate text-sm'>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
