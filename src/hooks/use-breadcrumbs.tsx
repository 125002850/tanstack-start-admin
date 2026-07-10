import { useMatches } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getAppRouteStaticData } from '@/lib/router/app-route-meta';
import { buildMenuTreeLookup, resolveBreadcrumbChain } from '@/lib/router/menu-tree-resolver';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export function useBreadcrumbs() {
  const { data: me } = useQuery(getIamMeQueryOptions());

  return useMatches({
    select: (matches): BreadcrumbItem[] =>
      matches.flatMap((match) => {
        const staticData = getAppRouteStaticData(match);
        if (!staticData) return [];

        const menuKey = staticData.nav?.menuKey;
        if (menuKey && me?.menus) {
          const lookup = buildMenuTreeLookup(me.menus);
          const chain = resolveBreadcrumbChain(lookup, menuKey);
          return chain.map((item) => ({
            title: item.label,
            link: match.pathname
          }));
        }

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
