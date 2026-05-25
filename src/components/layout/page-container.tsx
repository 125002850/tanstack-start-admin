import React from 'react';
import { Heading } from '../ui/heading';
import type { InfobarContent } from '@/components/ui/infobar';
import { useMatches, useRouter } from '@tanstack/react-router';
import { getAppRouteStaticData } from '@/lib/router/app-route-meta';

function PageSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4 p-4 md:px-6'>
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
  isLoading = false,
  access = true,
  accessFallback,
  pageTitle,
  pageDescription,
  infoContent,
  pageHeaderAction
}: {
  children: React.ReactNode;
  isLoading?: boolean;
  access?: boolean;
  accessFallback?: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  infoContent?: InfobarContent;
  pageHeaderAction?: React.ReactNode;
}) {
  const matches = useMatches();
  const router = useRouter();
  const deepestStaticData = React.useMemo(() => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const route = router.routesById[matches[i]?.routeId];
      if (route) {
        const sd = getAppRouteStaticData(route);
        if (sd) return sd;
      }
    }
    return undefined;
  }, [matches, router.routesById]);

  if (!access) {
    return (
      <div className='flex flex-1 items-center justify-center p-4 md:px-6'>
        {accessFallback ?? (
          <div className='text-muted-foreground text-center text-lg'>
            You do not have access to this page.
          </div>
        )}
      </div>
    );
  }

  const content = isLoading ? <PageSkeleton /> : children;

  const resolvedTitle = pageTitle ?? deepestStaticData?.page?.title ?? deepestStaticData?.label ?? '';
  const resolvedDescription = pageDescription ?? deepestStaticData?.page?.description ?? '';
  const resolvedInfoContent = infoContent ?? deepestStaticData?.page?.infoContent;
  const hasHeader = resolvedTitle || pageHeaderAction;

  return (
    <div className='flex flex-1 flex-col p-4 md:px-6'>
      {hasHeader && (
        <div className='mb-4 flex items-start justify-between gap-4'>
          <Heading
            title={resolvedTitle}
            description={resolvedDescription}
            infoContent={resolvedInfoContent}
          />
          {pageHeaderAction && <div className='shrink-0'>{pageHeaderAction}</div>}
        </div>
      )}
      {content}
    </div>
  );
}
