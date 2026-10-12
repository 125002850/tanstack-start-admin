import { buildBusinessCenterNav } from '@/lib/router/business-center-nav';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import { buildNavGroupsFromRoutes } from '@/lib/router/route-nav';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';
import { Link } from '@tanstack/react-router';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Icons } from '../icons';
import { SsoAvatarSkeleton, SsoTextSkeleton } from '@/components/ui/sso-skeleton';
import { getLoginInfoQueryOptions } from '@/lib/api/sso/queries';
import { logout } from '@/lib/api/sso/session';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { baseConfig } from '@/config';

const SIDEBAR_MENU_BUTTON_MOTION_CLASS = 'transition-colors motion-reduce:transition-none';
const SIDEBAR_LARGE_BUTTON_MOTION_CLASS =
  'transition-[color,background-color,border-color,padding] motion-reduce:transition-none';
const SIDEBAR_EXPANDED_LABEL_MOTION_CLASS =
  'animate-in fade-in-0 fill-mode-backwards delay-150 duration-75 motion-reduce:animate-none';
const SIDEBAR_SUBMENU_MOTION_CLASS =
  'motion-safe:data-[state=closed]:animate-collapsible-up motion-safe:data-[state=open]:animate-collapsible-down data-[state=closed]:animation-duration-150 data-[state=open]:animation-duration-200 overflow-hidden motion-reduce:animate-none';

function normalizePath(path: string): string {
  if (path === '/') return path;
  return path.replace(/\/$/, '');
}

function isRouteActive(pathname: string, targetPath: string): boolean {
  const current = normalizePath(pathname);
  const target = normalizePath(targetPath);

  return current === target || current.startsWith(`${target}/`);
}

function SidebarNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const { isMobile, state } = useSidebar();
  const Icon = item.icon ? Icons[item.icon] : Icons.logo;
  const hasChildren = Boolean(item.items?.length);
  const hasActiveChild =
    item.items?.some((subItem) => isRouteActive(pathname, subItem.url)) ?? false;
  const isActive = (item.linkable !== false && isRouteActive(pathname, item.url)) || hasActiveChild;
  const isCollapsedDesktop = state === 'collapsed' && !isMobile;
  const expandedLabelMotionClass =
    state === 'expanded' && !isMobile ? SIDEBAR_EXPANDED_LABEL_MOTION_CLASS : undefined;
  const [open, setOpen] = React.useState(() => hasActiveChild);

  React.useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  if (!hasChildren) {
    const isLinkable = item.linkable !== false;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild={isLinkable}
          tooltip={item.title}
          isActive={isActive}
          className={SIDEBAR_MENU_BUTTON_MOTION_CLASS}
        >
          {isLinkable ? (
            <Link to={item.url} className='flex min-w-0 w-full items-center'>
              {item.icon && <Icon className='size-4' />}
              <span
                className={cn(
                  'min-w-0 flex-1 truncate group-data-[state=collapsed]:opacity-0',
                  expandedLabelMotionClass
                )}
              >
                {item.title}
              </span>
            </Link>
          ) : (
            <span className='flex min-w-0 w-full items-center gap-2'>
              {item.icon && <Icon className='size-4' />}
              <span
                className={cn(
                  'min-w-0 flex-1 truncate group-data-[state=collapsed]:opacity-0',
                  expandedLabelMotionClass
                )}
              >
                {item.title}
              </span>
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (isCollapsedDesktop) {
    return (
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  aria-label={item.title}
                  isActive={isActive}
                  className={cn(
                    SIDEBAR_MENU_BUTTON_MOTION_CLASS,
                    'group-data-[collapsible=icon]:justify-center'
                  )}
                >
                  {item.icon && <Icon className='size-4' />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side='right' align='center'>
              {item.title}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side='right'
            align='start'
            sideOffset={6}
            className='w-64 rounded-xl p-2'
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className='text-muted-foreground px-2 py-1 text-xs font-semibold tracking-[0.12em] uppercase'>
                {item.title}
              </DropdownMenuLabel>
              {item.linkable !== false && (
                <DropdownMenuItem asChild className='rounded-md px-2 py-2'>
                  <Link to={item.url} className='flex items-center gap-2'>
                    <Icons.arrowRight className='size-4' />
                    <span>{item.title}</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            {item.linkable !== false && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {item.items?.map((subItem) => {
                const isSubItemActive = isRouteActive(pathname, subItem.url);
                const isSubLinkable = subItem.linkable !== false;

                return (
                  <DropdownMenuItem
                    key={subItem.id}
                    asChild={isSubLinkable}
                    className={cn(
                      'rounded-md px-2 py-2',
                      isSubItemActive && 'bg-accent text-accent-foreground'
                    )}
                  >
                    {isSubLinkable ? (
                      <Link to={subItem.url} className='flex items-center gap-3'>
                        <span className='flex-1 truncate'>{subItem.title}</span>
                        {isSubItemActive && (
                          <Icons.check className='size-4 text-accent-foreground' />
                        )}
                      </Link>
                    ) : (
                      <span className='flex items-center gap-3'>
                        <Icons.circle
                          className={cn(
                            'size-2 fill-current stroke-none',
                            isSubItemActive ? 'text-accent-foreground' : 'text-muted-foreground/50'
                          )}
                        />
                        <span className='flex-1 truncate'>{subItem.title}</span>
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} className='group/collapsible'>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive}
            className={SIDEBAR_MENU_BUTTON_MOTION_CLASS}
          >
            {item.icon && <Icon className='size-4' />}
            <span className={cn('min-w-0 flex-1 truncate', expandedLabelMotionClass)}>
              {item.title}
            </span>
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center',
                expandedLabelMotionClass
              )}
            >
              <Icons.chevronRight className='size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none' />
            </span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className={SIDEBAR_SUBMENU_MOTION_CLASS}>
          <SidebarMenuSub>
            {item.items?.map((subItem) => {
              const isSubLinkable = subItem.linkable !== false;
              return (
                <SidebarMenuSubItem key={subItem.id}>
                  <SidebarMenuSubButton
                    asChild={isSubLinkable}
                    isActive={isRouteActive(pathname, subItem.url)}
                  >
                    {isSubLinkable ? (
                      <Link to={subItem.url}>
                        <span className='min-w-0 truncate'>{subItem.title}</span>
                      </Link>
                    ) : (
                      <span className='min-w-0 truncate'>{subItem.title}</span>
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export default function AppSidebar() {
  const { pathname } = useLocation();
  const router = useRouter();
  const { isMobile, state } = useSidebar();
  const expandedLabelMotionClass =
    state === 'expanded' && !isMobile ? SIDEBAR_EXPANDED_LABEL_MOTION_CLASS : undefined;
  const navGroups = React.useMemo(
    () => buildNavGroupsFromRoutes(router.routesById),
    [router.routesById]
  );
  const filteredGroups = useFilteredNavGroups(navGroups);
  const { data: loginUser, isLoading } = useQuery(getLoginInfoQueryOptions());

  const handleLogout = () => {
    logout();
  };

  return (
    <Sidebar variant='inset' collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild className={SIDEBAR_LARGE_BUTTON_MOTION_CLASS}>
              <Link to='/overview'>
                <div className='bg-primary text-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-md'>
                  <Icons.logo className='size-4' />
                </div>
                <div
                  className={cn(
                    'grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[state=collapsed]:opacity-0',
                    expandedLabelMotionClass
                  )}
                >
                  <span className='truncate font-semibold'>{baseConfig.projectName}</span>
                  <span className='text-muted-foreground truncate text-xs'>工作台</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup className='py-0'>
          <SidebarMenu>
            {buildBusinessCenterNav(filteredGroups).map((item) => (
              <SidebarNavItem key={item.id ?? item.title} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  aria-label='用户菜单'
                  size='lg'
                  className={cn(
                    SIDEBAR_LARGE_BUTTON_MOTION_CLASS,
                    'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                  )}
                >
                  {isLoading ? (
                    <>
                      <SsoAvatarSkeleton size={32} />
                      <div
                        className={cn(
                          'grid min-w-0 flex-1 gap-1 group-data-[state=collapsed]:opacity-0',
                          expandedLabelMotionClass
                        )}
                      >
                        <SsoTextSkeleton width='60%' className='h-3' />
                        <SsoTextSkeleton width='80%' className='h-2.5' />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='bg-muted flex aspect-square size-8 shrink-0 items-center justify-center rounded-full'>
                        <Icons.account className='size-4' />
                      </div>
                      <div
                        className={cn(
                          'grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[state=collapsed]:opacity-0',
                          expandedLabelMotionClass
                        )}
                      >
                        <span className='truncate font-medium'>
                          {loginUser?.realName || loginUser?.userName || '用户'}
                        </span>
                        <span className='text-muted-foreground truncate text-xs'>
                          {loginUser?.phone || '-'}
                        </span>
                      </div>
                    </>
                  )}
                  <Icons.chevronsDown
                    className={cn(
                      'ml-auto size-4 shrink-0 group-data-[state=collapsed]:opacity-0',
                      expandedLabelMotionClass
                    )}
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.navigate({ to: '/notifications' })}>
                    <Icons.notification className='mr-2 h-4 w-4' />
                    通知
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleLogout}>
                    <Icons.logout className='size-4' />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
