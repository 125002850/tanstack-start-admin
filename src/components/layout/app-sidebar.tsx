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
import * as React from 'react';
import { Icons } from '../icons';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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
  const isActive = isRouteActive(pathname, item.url) || hasActiveChild;
  const isCollapsedDesktop = state === 'collapsed' && !isMobile;
  const [open, setOpen] = React.useState(() => hasActiveChild);
  const [flyoutOpen, setFlyoutOpen] = React.useState(false);
  const menuItemRef = React.useRef<HTMLLIElement | null>(null);
  const flyoutContentRef = React.useRef<HTMLDivElement | null>(null);
  const lastInteractionRef = React.useRef<'pointer' | 'keyboard' | null>(null);
  const openTimerRef = React.useRef<number | null>(null);
  const closeTimerRef = React.useRef<number | null>(null);

  const clearOpenTimer = React.useCallback(() => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const blurTriggerIfFocused = React.useCallback(() => {
    const trigger = menuItemRef.current?.querySelector<HTMLElement>('[data-sidebar="menu-button"]');
    if (trigger && document.activeElement === trigger) {
      trigger.blur();
    }
  }, []);

  const releaseFlyoutFocus = React.useCallback(() => {
    const activeElement = document.activeElement;
    const content = flyoutContentRef.current;

    if (content && activeElement instanceof HTMLElement && content.contains(activeElement)) {
      activeElement.blur();
    }

    blurTriggerIfFocused();
  }, [blurTriggerIfFocused]);

  const scheduleFlyoutOpen = React.useCallback(() => {
    lastInteractionRef.current = 'pointer';
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setFlyoutOpen(true);
    }, 140);
  }, [clearCloseTimer, clearOpenTimer]);

  const scheduleFlyoutClose = React.useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setFlyoutOpen(false);
    }, 220);
  }, [clearCloseTimer, clearOpenTimer]);

  const handleFlyoutOpenChange = React.useCallback((nextOpen: boolean) => {
    setFlyoutOpen(nextOpen);
  }, []);

  React.useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearOpenTimer]);

  React.useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  React.useEffect(() => {
    if (!flyoutOpen || lastInteractionRef.current !== 'pointer') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      releaseFlyoutFocus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [flyoutOpen, releaseFlyoutFocus]);

  if (!hasChildren) {
    const isLinkable = item.linkable !== false;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild={isLinkable} tooltip={item.title} isActive={isActive}>
          {isLinkable ? (
            <Link to={item.url}>
              {item.icon && <Icon />}
              <span>{item.title}</span>
            </Link>
          ) : (
            <span className='flex items-center gap-2'>
              {item.icon && <Icon />}
              <span>{item.title}</span>
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (isCollapsedDesktop) {
    return (
      <li
        ref={menuItemRef}
        data-slot='sidebar-menu-item'
        data-sidebar='menu-item'
        className='group/menu-item relative'
        onMouseEnter={scheduleFlyoutOpen}
        onMouseLeave={scheduleFlyoutClose}
      >
        <DropdownMenu modal={false} open={flyoutOpen} onOpenChange={handleFlyoutOpenChange}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label={item.title}
              isActive={isActive}
              className='group-data-[collapsible=icon]:justify-center'
              onPointerDown={() => {
                lastInteractionRef.current = 'pointer';
              }}
              onKeyDown={() => {
                lastInteractionRef.current = 'keyboard';
              }}
            >
              {item.icon && <Icon />}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            ref={flyoutContentRef}
            side='right'
            align='start'
            sideOffset={6}
            className='w-64 rounded-xl p-2'
            onCloseAutoFocus={(event) => {
              if (lastInteractionRef.current === 'pointer') {
                event.preventDefault();
                blurTriggerIfFocused();
              }
            }}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleFlyoutClose}
          >
            <DropdownMenuLabel className='text-muted-foreground px-2 py-1 text-xs font-semibold tracking-[0.12em] uppercase'>
              {item.title}
            </DropdownMenuLabel>
            {item.linkable !== false && (
              <>
                <DropdownMenuItem asChild className='rounded-md px-2 py-2'>
                  <Link to={item.url} className='flex items-center gap-2'>
                    <Icons.arrowRight className='size-4' />
                    <span>{item.title}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
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
                        <Icons.circle
                          className={cn(
                            'size-2 fill-current stroke-none',
                            isSubItemActive ? 'text-primary' : 'text-muted-foreground/50'
                          )}
                        />
                        <span className='flex-1 truncate'>{subItem.title}</span>
                        {isSubItemActive && <Icons.check className='size-4 text-primary' />}
                      </Link>
                    ) : (
                      <span className='flex items-center gap-3'>
                        <Icons.circle
                          className={cn(
                            'size-2 fill-current stroke-none',
                            isSubItemActive ? 'text-primary' : 'text-muted-foreground/50'
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
      </li>
    );
  }

  return (
    <Collapsible
      asChild
      open={hasActiveChild || open}
      onOpenChange={setOpen}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive}>
            {item.icon && <Icon />}
            <span>{item.title}</span>
            <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
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
                        <span>{subItem.title}</span>
                      </Link>
                    ) : (
                      <span>{subItem.title}</span>
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
  const navGroups = React.useMemo(
    () => buildNavGroupsFromRoutes(router.routesById),
    [router.routesById]
  );
  const filteredGroups = useFilteredNavGroups(navGroups);

  return (
    <Sidebar variant='inset' collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link to='/dashboard/overview'>
                <div className='bg-primary text-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-md'>
                  <Icons.logo className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>管理系统</span>
                  <span className='text-muted-foreground truncate text-xs'>控制台</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'} className='py-0'>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarNavItem key={item.title} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                  <div className='bg-muted flex aspect-square size-8 shrink-0 items-center justify-center rounded-full'>
                    <Icons.account className='size-4' />
                  </div>
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='truncate font-medium'>用户</span>
                    <span className='text-muted-foreground truncate text-xs'>user@example.com</span>
                  </div>
                  <Icons.chevronsDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => router.navigate({ to: '/dashboard/notifications' })}
                  >
                    <Icons.notification className='mr-2 h-4 w-4' />
                    通知
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Icons.logout className='mr-2 h-4 w-4' />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
