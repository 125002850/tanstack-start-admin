import { useMatches } from '@tanstack/react-router';
import { getAppRouteStaticData } from '@/lib/router/app-route-meta';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export function useBreadcrumbs() {
  return useMatches({
    select: (matches): BreadcrumbItem[] =>
      matches.flatMap((match) => {
        const staticData = getAppRouteStaticData(match);
        const title = staticData?.breadcrumb?.label ?? staticData?.label;
        if (!title) return [];

        return [
          {
            title,
            link: staticData?.breadcrumb?.to ?? match.pathname
          }
        ];
      })
  });
}
