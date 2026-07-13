import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { getMenuNodeStableId, isMenuNodeCollapsible, type FlatMenuNode } from '../lib/tree';

interface MenuTreeListProps {
  rows: readonly FlatMenuNode[];
  keyword: string;
  selectedMenuId: string | null;
  collapsedMenuIds: ReadonlySet<string>;
  isFiltering: boolean;
  isFetching: boolean;
  canManage: boolean;
  canToggleAll: boolean;
  allCollapsed: boolean;
  onKeywordChange: (keyword: string) => void;
  onSelect: (menu: FlatMenuNode) => void;
  onToggleCollapse: (menu: FlatMenuNode) => void;
  onToggleAll: () => void;
  onRefresh: () => void;
  onCreateRoot: () => void;
}

export function MenuTreeList({
  rows,
  keyword,
  selectedMenuId,
  collapsedMenuIds,
  isFiltering,
  isFetching,
  canManage,
  canToggleAll,
  allCollapsed,
  onKeywordChange,
  onSelect,
  onToggleCollapse,
  onToggleAll,
  onRefresh,
  onCreateRoot
}: MenuTreeListProps) {
  return (
    <Card className='xl:sticky xl:top-0'>
      <CardHeader>
        <CardTitle>菜单树</CardTitle>
        <CardDescription>目录与页面菜单；按钮权限在右侧维护</CardDescription>
        {canManage ? (
          <CardAction>
            <Button variant='outline' size='icon' onClick={onCreateRoot}>
              <Icons.add className='size-4' />
              <span className='sr-only'>新增根目录或菜单</span>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className='min-h-0 gap-4'>
        <Input
          type='search'
          aria-label='搜索菜单树'
          value={keyword}
          placeholder='搜索菜单名称 / 编码 / 权限'
          onChange={(event) => onKeywordChange(event.target.value)}
        />

        <div role='toolbar' aria-label='菜单树操作' className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' size='sm' disabled={isFetching} onClick={onRefresh}>
            <Icons.rotateClockwise className='size-4' />
            刷新
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={!canToggleAll}
            aria-label={allCollapsed ? '展开全部菜单' : '折叠全部菜单'}
            onClick={onToggleAll}
          >
            {allCollapsed ? (
              <Icons.chevronDown className='size-4' />
            ) : (
              <Icons.chevronRight className='size-4' />
            )}
            {allCollapsed ? '展开' : '折叠'}
          </Button>
        </div>

        <div
          role='list'
          aria-label='菜单树'
          className='flex max-h-[64vh] flex-col gap-1 overflow-y-auto pr-1'
        >
          {rows.length > 0 ? (
            rows.map((menu) => {
              const menuId = getMenuNodeStableId(menu);
              const menuName = menu.menuName ?? menu.menuCode ?? '-';
              const collapsible = isMenuNodeCollapsible(menu);
              const collapsed = collapsedMenuIds.has(menuId);
              const selected = selectedMenuId === menuId;
              const NodeIcon = menu.menuType === 'DIR' ? Icons.workspace : Icons.page;

              return (
                <div
                  key={menuId}
                  role='listitem'
                  data-state={selected ? 'selected' : 'idle'}
                  className='flex min-w-0 items-center gap-1'
                  style={{ paddingLeft: menu.depth * 12 }}
                >
                  {collapsible ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='size-7 shrink-0'
                      aria-label={`${collapsed ? '展开' : '折叠'} ${menuName}`}
                      aria-expanded={!collapsed}
                      disabled={isFiltering}
                      onClick={() => onToggleCollapse(menu)}
                    >
                      {collapsed ? (
                        <Icons.chevronRight className='size-4' />
                      ) : (
                        <Icons.chevronDown className='size-4' />
                      )}
                    </Button>
                  ) : (
                    <span className='size-7 shrink-0' aria-hidden='true' />
                  )}

                  <Button
                    type='button'
                    variant={selected ? null : 'ghost'}
                    aria-label={`选择 ${menuName}`}
                    aria-pressed={selected}
                    className={cn(
                      'h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-2 text-left',
                      selected &&
                        'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground'
                    )}
                    onClick={() => onSelect(menu)}
                  >
                    <NodeIcon className='size-4 shrink-0' />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-sm font-medium'>{menuName}</span>
                      <span
                        className={cn(
                          'block truncate text-xs',
                          selected ? 'text-sidebar-accent-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {menu.menuCode ?? '-'}
                      </span>
                    </span>
                  </Button>
                </div>
              );
            })
          ) : (
            <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm'>
              {isFetching ? '加载菜单树中...' : '没有匹配的目录或菜单'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
