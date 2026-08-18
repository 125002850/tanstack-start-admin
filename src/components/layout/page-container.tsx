import React from 'react';
import { Heading } from '../ui/heading';
import type { InfobarContent } from '@/components/ui/infobar';
import { cn } from '@/lib/utils';

const PAGE_CONTAINER_PADDING_CLASSES =
  'p-4 md:px-6 [--page-container-padding-x:1rem] md:[--page-container-padding-x:1.5rem]';

export type PageContentSizing = 'flow' | 'contained';

interface PageContentProps extends React.ComponentProps<'div'> {
  contentSizing?: PageContentSizing;
}

export function PageContent({ contentSizing = 'flow', className, ...props }: PageContentProps) {
  return (
    <div
      data-slot='page-content'
      className={cn(
        'grid min-w-0 flex-1',
        contentSizing === 'contained' && 'min-h-0 overflow-hidden',
        className
      )}
      {...props}
    />
  );
}

function PageSkeleton() {
  return (
    <div className={`flex flex-1 animate-pulse flex-col gap-4 ${PAGE_CONTAINER_PADDING_CLASSES}`}>
      <div className='flex items-center justify-between'>
        <div>
          <div className='bg-muted mb-2 h-8 w-48 rounded' />
          <div className='bg-muted h-4 w-96 rounded' />
        </div>
      </div>
      <div className='bg-muted mt-6 h-40 w-full rounded-lg' />
      <div className='bg-muted h-40 w-full rounded-lg' />
    </div>
  );
}

export default function PageContainer({
  children,
  contentSizing = 'flow',
  isLoading = false,
  access = true,
  accessFallback,
  pageTitle,
  pageDescription,
  infoContent,
  pageHeaderAction
}: {
  children: React.ReactNode;
  contentSizing?: PageContentSizing;
  isLoading?: boolean;
  access?: boolean;
  accessFallback?: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  infoContent?: InfobarContent;
  pageHeaderAction?: React.ReactNode;
}) {
  if (!access) {
    return (
      <div className={`flex flex-1 items-center justify-center ${PAGE_CONTAINER_PADDING_CLASSES}`}>
        {accessFallback ?? (
          <div className='text-muted-foreground text-center text-lg'>您没有访问此页面的权限</div>
        )}
      </div>
    );
  }

  const content = isLoading ? <PageSkeleton /> : children;
  const hasHeader = pageTitle || pageHeaderAction;

  return (
    <div
      className={cn(
        'flex flex-1 flex-col min-w-0',
        contentSizing === 'contained' && 'min-h-0 overflow-hidden',
        PAGE_CONTAINER_PADDING_CLASSES
      )}
    >
      {hasHeader && (
        <div className='mb-4 flex items-start justify-between gap-4'>
          <Heading
            title={pageTitle ?? ''}
            description={pageDescription ?? ''}
            infoContent={infoContent}
          />
          {pageHeaderAction && <div className='shrink-0'>{pageHeaderAction}</div>}
        </div>
      )}
      <PageContent contentSizing={contentSizing}>{content}</PageContent>
    </div>
  );
}
