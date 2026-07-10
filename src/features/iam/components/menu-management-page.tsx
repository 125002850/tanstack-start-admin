import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useConfirmAction } from '@/hooks/use-confirm-action';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { hasIamPermission } from '@/lib/api/iam/permissions';
import {
  iamMenuCreate,
  iamMenuDelete,
  iamMenuStatusUpdate,
  iamMenuUpdate,
  type MenuCreateReqDTO,
  type MenuRspDTO,
  type MenuUpdateReqDTO
} from '@/lib/api/clients/service';
import { iamMenuTreeQueryOptions } from '../api/query-options';
import { IAM_PERMISSIONS } from '../lib/constants';
import { nextStatus } from '../lib/format';
import {
  collectCollapsibleMenuIds,
  filterVisibleMenuRows,
  flattenMenuTree,
  getMenuNodeStableId,
  type MenuTreeNode
} from '../lib/tree';
import { MenuButtonPermissionsPanel } from './menu-button-permissions-panel';
import { MenuDetails } from './menu-details';
import MenuFormSheet, { type MenuFormValues } from './menu-form-sheet';
import { MenuTreeList } from './menu-tree-list';

const EMPTY_MENU_TREE: MenuRspDTO[] = [];
const EMPTY_COLLAPSED_MENU_IDS = new Set<string>();

function menuMatchesKeyword(menu: MenuRspDTO, keyword: string) {
  return [menu.menuName, menu.menuCode, menu.menuKey, menu.routePath, menu.permissionCode].some(
    (value) => value?.toLocaleLowerCase().includes(keyword)
  );
}

function pruneMenuNavigationTree(nodes: readonly MenuRspDTO[]): MenuTreeNode[] {
  return nodes.flatMap((menu) => {
    if (menu.menuType === 'BUTTON') return [];

    const node = menu as MenuTreeNode;
    return [
      {
        ...node,
        children: pruneMenuNavigationTree(node.children ?? [])
      }
    ];
  });
}

function filterMenuNavigationTree(
  nodes: readonly MenuRspDTO[],
  normalizedKeyword: string
): MenuTreeNode[] {
  if (!normalizedKeyword) return pruneMenuNavigationTree(nodes);

  return nodes.flatMap((menu) => {
    if (menu.menuType === 'BUTTON') return [];

    const node = menu as MenuTreeNode;
    const children = node.children ?? [];
    const matchingNavigationChildren = filterMenuNavigationTree(children, normalizedKeyword);
    const matchingButtonChild = children.some(
      (child) => child.menuType === 'BUTTON' && menuMatchesKeyword(child, normalizedKeyword)
    );

    if (menuMatchesKeyword(menu, normalizedKeyword)) {
      return [
        {
          ...node,
          children: pruneMenuNavigationTree(children)
        }
      ];
    }

    if (matchingNavigationChildren.length > 0 || matchingButtonChild) {
      return [
        {
          ...node,
          children: matchingNavigationChildren
        }
      ];
    }

    return [];
  });
}

function invalidateMenuTree(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['service', 'iam-menu'], exact: false }),
    queryClient.invalidateQueries({ queryKey: ['iam', 'me'], exact: false })
  ]);
}

function toMenuUpdateRequest(menu: MenuRspDTO, cached: boolean): MenuUpdateReqDTO {
  if (
    menu.menuId == null ||
    !menu.menuCode ||
    !menu.menuName ||
    (menu.menuType !== 'DIR' && menu.menuType !== 'MENU' && menu.menuType !== 'BUTTON')
  ) {
    throw new Error('菜单数据不完整，无法更新页面缓存');
  }

  return {
    menuId: menu.menuId,
    parentId: menu.parentId,
    menuCode: menu.menuCode,
    menuName: menu.menuName,
    menuType: menu.menuType,
    routePath: menu.routePath ?? undefined,
    componentPath: menu.componentPath ?? undefined,
    icon: menu.icon ?? undefined,
    sortOrder: menu.sortOrder ?? undefined,
    hidden: menu.hidden ?? false,
    cached,
    status: menu.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
    permissionCode: menu.permissionCode ?? undefined,
    remark: menu.remark ?? undefined
  };
}

export default function MenuManagementPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const [keyword, setKeyword] = React.useState('');
  const [requestedMenuId, setRequestedMenuId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingMenu, setEditingMenu] = React.useState<MenuRspDTO | null>(null);
  const [parentMenu, setParentMenu] = React.useState<MenuRspDTO | null>(null);
  const [initialMenuType, setInitialMenuType] = React.useState<MenuFormValues['menuType']>('MENU');
  const [collapsedMenuIds, setCollapsedMenuIds] = React.useState<Set<string>>(() => new Set());
  const query = useQuery(iamMenuTreeQueryOptions());
  const { isFetching: isMenuTreeFetching, refetch: refetchMenuTree } = query;
  const menuTree = query.data ?? EMPTY_MENU_TREE;
  const allRows = React.useMemo(() => flattenMenuTree(menuTree), [menuTree]);
  const allRowsById = React.useMemo(
    () => new Map(allRows.map((menu) => [getMenuNodeStableId(menu), menu])),
    [allRows]
  );
  const menuNameById = React.useMemo(
    () =>
      new Map(
        allRows
          .filter((menu) => menu.menuId != null)
          .map((menu) => [
            String(menu.menuId),
            menu.menuName ?? menu.menuCode ?? String(menu.menuId)
          ])
      ),
    [allRows]
  );
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const visibleCollapsedMenuIds = normalizedKeyword ? EMPTY_COLLAPSED_MENU_IDS : collapsedMenuIds;
  const navigationTree = React.useMemo(
    () => filterMenuNavigationTree(menuTree, normalizedKeyword),
    [menuTree, normalizedKeyword]
  );
  const navigationRows = React.useMemo(() => flattenMenuTree(navigationTree), [navigationTree]);
  const selectedNavigationMenu =
    navigationRows.find((menu) => getMenuNodeStableId(menu) === requestedMenuId) ??
    navigationRows[0] ??
    null;
  const selectedMenuId = selectedNavigationMenu
    ? getMenuNodeStableId(selectedNavigationMenu)
    : null;
  const selectedMenu = selectedMenuId ? (allRowsById.get(selectedMenuId) ?? null) : null;
  const selectedMenuParentName =
    selectedMenu?.parentId == null
      ? '根菜单'
      : (menuNameById.get(String(selectedMenu.parentId)) ?? '-');
  const collapsibleMenuIds = React.useMemo(
    () => collectCollapsibleMenuIds(navigationRows),
    [navigationRows]
  );
  const collapsedMenuCount = React.useMemo(
    () => Array.from(visibleCollapsedMenuIds).filter((id) => collapsibleMenuIds.has(id)).length,
    [collapsibleMenuIds, visibleCollapsedMenuIds]
  );
  const rows = React.useMemo(
    () => filterVisibleMenuRows(navigationRows, visibleCollapsedMenuIds),
    [navigationRows, visibleCollapsedMenuIds]
  );
  const uncachedPageMenus = React.useMemo(
    () => allRows.filter((menu) => menu.menuType === 'MENU' && menu.cached !== true),
    [allRows]
  );
  const { withConfirm, confirmDialog } = useConfirmAction<[MenuRspDTO]>();
  const { withConfirm: withPageCacheConfirm, confirmDialog: pageCacheConfirmDialog } =
    useConfirmAction<[readonly MenuRspDTO[]]>();
  const canManageMenu = hasIamPermission(me, IAM_PERMISSIONS.menu.manage);

  const toggleMenuCollapse = React.useCallback((menu: MenuRspDTO) => {
    const menuId = getMenuNodeStableId(menu);
    setCollapsedMenuIds((current) => {
      const next = new Set(current);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }, []);

  const allMenusCollapsed =
    collapsibleMenuIds.size > 0 && collapsedMenuCount === collapsibleMenuIds.size;

  const toggleAllMenus = React.useCallback(() => {
    setCollapsedMenuIds(allMenusCollapsed ? new Set() : new Set(collapsibleMenuIds));
  }, [allMenusCollapsed, collapsibleMenuIds]);

  const openCreateMenu = React.useCallback(
    (parent: MenuRspDTO | null, menuType: MenuFormValues['menuType']) => {
      setEditingMenu(null);
      setParentMenu(parent);
      setInitialMenuType(menuType);
      setFormOpen(true);
    },
    []
  );

  const openEditMenu = React.useCallback((menu: MenuRspDTO) => {
    setEditingMenu(menu);
    setParentMenu(null);
    setInitialMenuType('MENU');
    setFormOpen(true);
  }, []);

  const createMutation = useMutation({
    mutationFn: (request: MenuCreateReqDTO) => iamMenuCreate(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单已创建');
    }
  });
  const updateMutation = useMutation({
    mutationFn: (request: MenuUpdateReqDTO) => iamMenuUpdate(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单已更新');
    }
  });
  const enablePageCacheMutation = useMutation({
    mutationFn: async (menus: readonly MenuRspDTO[]) => {
      await Promise.all(menus.map((menu) => iamMenuUpdate(toMenuUpdateRequest(menu, true))));
    },
    onSuccess: () => {
      toast.success('页面缓存已开启');
    },
    onSettled: () => invalidateMenuTree(queryClient)
  });
  const statusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamMenuStatusUpdate>[0]) =>
      iamMenuStatusUpdate(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单状态已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamMenuDelete>[0]) => iamMenuDelete(request),
    onSuccess: async () => {
      await invalidateMenuTree(queryClient);
      toast.success('菜单已删除');
    }
  });
  const confirmMenuStatus = React.useMemo(
    () =>
      withConfirm({
        title: () => '确认切换菜单状态',
        description: (menu) =>
          `确认将 ${menu.menuName ?? '该菜单'} ${menu.status === 'ENABLED' ? '停用' : '启用'}？`,
        confirmText: '确认',
        cancelText: '取消',
        run: async (menu) => {
          if (!menu.menuId) return;
          await statusMutation.mutateAsync({
            menuId: menu.menuId,
            status: nextStatus(menu.status)
          });
        }
      }),
    [statusMutation, withConfirm]
  );
  const confirmMenuDelete = React.useMemo(
    () =>
      withConfirm({
        title: () => '确认删除菜单',
        description: (menu) => `删除后 ${menu.menuName ?? '该菜单'} 不可恢复。`,
        confirmText: '确认删除',
        cancelText: '取消',
        run: async (menu) => {
          if (!menu.menuId) return;
          await deleteMutation.mutateAsync({ menuId: menu.menuId });
        }
      }),
    [deleteMutation, withConfirm]
  );
  const confirmEnablePageCache = React.useMemo(
    () =>
      withPageCacheConfirm({
        title: '确认开启页面缓存',
        description: (menus) => `将为 ${menus.length} 个页面菜单开启页面缓存。`,
        confirmText: '开启',
        cancelText: '取消',
        run: async (menus) => {
          await enablePageCacheMutation.mutateAsync(menus);
        }
      }),
    [enablePageCacheMutation, withPageCacheConfirm]
  );
  return (
    <>
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start'>
        <MenuTreeList
          rows={rows}
          keyword={keyword}
          selectedMenuId={selectedMenuId}
          collapsedMenuIds={visibleCollapsedMenuIds}
          isFiltering={Boolean(normalizedKeyword)}
          isFetching={isMenuTreeFetching}
          canManage={canManageMenu}
          canToggleAll={!normalizedKeyword && collapsibleMenuIds.size > 0}
          allCollapsed={allMenusCollapsed}
          canEnablePageCache={uncachedPageMenus.length > 0}
          isEnablingPageCache={enablePageCacheMutation.isPending}
          onKeywordChange={setKeyword}
          onSelect={(menu) => setRequestedMenuId(getMenuNodeStableId(menu))}
          onToggleCollapse={toggleMenuCollapse}
          onToggleAll={toggleAllMenus}
          onEnablePageCache={() => confirmEnablePageCache(uncachedPageMenus)}
          onRefresh={() => {
            void refetchMenuTree();
          }}
          onCreateRoot={() => openCreateMenu(null, 'DIR')}
        />

        <div className='flex min-w-0 flex-col gap-4'>
          <MenuDetails
            record={selectedMenu}
            parentMenuName={selectedMenuParentName}
            canManage={canManageMenu}
            onCreateChild={() => selectedMenu && openCreateMenu(selectedMenu, 'MENU')}
            onEdit={() => selectedMenu && openEditMenu(selectedMenu)}
            onToggleStatus={() => selectedMenu && confirmMenuStatus(selectedMenu)}
            onDelete={() => selectedMenu && confirmMenuDelete(selectedMenu)}
          />
          <MenuButtonPermissionsPanel
            record={selectedMenu}
            canManage={canManageMenu}
            onCreate={() => selectedMenu && openCreateMenu(selectedMenu, 'BUTTON')}
            onEdit={openEditMenu}
            onToggleStatus={confirmMenuStatus}
            onDelete={confirmMenuDelete}
          />
        </div>
      </div>
      {confirmDialog}
      {pageCacheConfirmDialog}
      <MenuFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        menu={editingMenu}
        parent={parentMenu}
        initialMenuType={initialMenuType}
        tree={menuTree}
        onSubmit={async (payload) => {
          if ('menuId' in payload) {
            await updateMutation.mutateAsync(payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
      />
    </>
  );
}
