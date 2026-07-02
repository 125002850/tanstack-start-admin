import * as React from 'react';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className='overflow-hidden p-4 min-w-0 w-full'>
      <div className='mb-3'>
        <CardTitle className='text-sm font-semibold'>{title}</CardTitle>
        {description && <CardDescription className='mt-0.5 text-xs'>{description}</CardDescription>}
      </div>
      <Separator className='-mx-4 mb-3 w-[calc(100%+2rem)]' />
      <div>{children}</div>
    </Card>
  );
}
