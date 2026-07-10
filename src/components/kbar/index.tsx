import { KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarSearch } from 'kbar';
import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import RenderResults from './render-result';
import useThemeSwitching from './use-theme-switching';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import { buildNavGroupsFromRoutes } from '@/lib/router/route-nav';
import { buildMenuTreeLookup } from '@/lib/router/menu-tree-resolver';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { Icons } from '@/components/icons';

function navActionIcon(icon: keyof typeof Icons | undefined) {
  if (!icon) return undefined;
  const Icon = Icons[icon];
  return <Icon className='size-4' />;
}

export default function KBar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const treeLookup = useMemo(() => buildMenuTreeLookup(me?.menus ?? []), [me?.menus]);
  const navGroups = useMemo(
    () => buildNavGroupsFromRoutes(router.routesById, treeLookup),
    [router.routesById, treeLookup]
  );
  const filteredGroups = useFilteredNavGroups(navGroups);

  const actions = useMemo(() => {
    const navigateTo = (url: string) => {
      router.navigate({ to: url });
    };

    const allItems = filteredGroups.flatMap((group) => group.items);

    return allItems.flatMap((navItem) => {
      const baseAction =
        navItem.linkable !== false
          ? {
              id: navItem.id,
              name: navItem.title,
              shortcut: navItem.shortcut,
              keywords: navItem.title.toLowerCase(),
              section: '导航',
              subtitle: `前往 ${navItem.title}`,
              icon: navActionIcon(navItem.icon),
              perform: () => navigateTo(navItem.url)
            }
          : null;

      const childActions =
        navItem.items
          ?.filter((childItem) => childItem.linkable !== false)
          .map((childItem) => ({
            id: childItem.id,
            name: childItem.title,
            shortcut: childItem.shortcut,
            keywords: childItem.title.toLowerCase(),
            section: navItem.title,
            subtitle: `前往 ${childItem.title}`,
            icon: navActionIcon(childItem.icon),
            perform: () => navigateTo(childItem.url)
          })) ?? [];

      return baseAction ? [baseAction, ...childActions] : childActions;
    });
  }, [router, filteredGroups]);

  return (
    <KBarProvider actions={actions}>
      <KBarComponent>{children}</KBarComponent>
    </KBarProvider>
  );
}
const KBarComponent = ({ children }: { children: React.ReactNode }) => {
  useThemeSwitching();

  return (
    <>
      <KBarPortal>
        <KBarPositioner className='bg-background/80 fixed inset-0 z-99999 p-0! backdrop-blur-sm'>
          <KBarAnimator className='bg-card text-card-foreground relative mt-64! w-full max-w-[600px] -translate-y-12! overflow-hidden rounded-lg border shadow-lg'>
            <div className='bg-card border-border sticky top-0 z-10 border-b'>
              <KBarSearch
                className='bg-card w-full border-none px-6 py-4 text-lg outline-hidden focus:ring-0 focus:ring-offset-0 focus:outline-hidden'
                placeholder='输入命令或搜索...'
              />
            </div>
            <div className='max-h-[400px]'>
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </>
  );
};
