import { useState } from 'react';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';

const TABLER_ICONS_URL = 'https://tabler.io/icons';

function TablerIconsLink() {
  return (
    <a
      href={TABLER_ICONS_URL}
      target='_blank'
      rel='noopener noreferrer'
      className={buttonVariants({ variant: 'outline' })}
    >
      <Icons.externalLink className='mr-2 size-4' />
      <span className='hidden sm:inline'>Browse</span> Tabler Icons
    </a>
  );
}

export function IconsManagementPage() {
  const [search, setSearch] = useState('');

  const iconEntries = Object.entries(Icons).filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          placeholder='Search icons...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='max-w-sm min-w-64 flex-1'
        />
        <TablerIconsLink />
      </div>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'>
        {iconEntries.map(([name, IconComponent]) => (
          <div
            key={name}
            className='hover:bg-accent flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors'
          >
            <IconComponent className='h-6 w-6' />
            <span className='text-muted-foreground text-xs break-all'>{name}</span>
          </div>
        ))}
      </div>
      {iconEntries.length === 0 && (
        <p className='text-muted-foreground py-8 text-center'>
          No icons found matching &quot;{search}&quot;
        </p>
      )}
    </div>
  );
}

export default function IconsScreen() {
  return (
    <PageContainer>
      <IconsManagementPage />
    </PageContainer>
  );
}
