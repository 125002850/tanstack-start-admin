import type { MultiSelectComboboxOption } from '@/components/ui/multi-select-combobox';
import type { DeptRspDTO, MenuRspDTO } from '@/lib/api/clients/service';

type TreeLike<TNode> = TNode & {
  children?: Array<TreeLike<TNode>>;
};

type FlatNode<TNode> = TNode & {
  depth: number;
};

export type MenuTreeNode = MenuRspDTO & {
  children?: MenuTreeNode[];
};

export type FlatMenuNode = MenuRspDTO & {
  depth: number;
  children?: MenuTreeNode[];
};

function flattenTree<TNode>(
  nodes: readonly TreeLike<TNode>[] = [],
  depth = 0
): Array<FlatNode<TNode>> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTree<TNode>(node.children ?? [], depth + 1)
  ]);
}

function prefixLabel(depth: number, label: string) {
  return `${'  '.repeat(depth)}${depth > 0 ? '└ ' : ''}${label}`;
}

export function flattenDeptTree(nodes: readonly DeptRspDTO[] = []) {
  return flattenTree<DeptRspDTO>(nodes as readonly TreeLike<DeptRspDTO>[]);
}

export function flattenMenuTree(nodes: readonly MenuRspDTO[] = []) {
  return flattenTree<MenuRspDTO>(nodes as readonly TreeLike<MenuRspDTO>[]) as FlatMenuNode[];
}

export function getMenuNodeStableId(menu: Pick<MenuRspDTO, 'menuCode' | 'menuId'>): string {
  if (menu.menuId != null) return String(menu.menuId);
  return `code:${menu.menuCode ?? ''}`;
}

export function isMenuNodeCollapsible(menu: Pick<FlatMenuNode, 'children'>): boolean {
  return Array.isArray(menu.children) && menu.children.some((child) => child.menuType !== 'BUTTON');
}

export function collectCollapsibleMenuIds(rows: readonly FlatMenuNode[]): Set<string> {
  return new Set(
    rows.filter((menu) => isMenuNodeCollapsible(menu)).map((menu) => getMenuNodeStableId(menu))
  );
}

export function filterVisibleMenuRows(
  rows: readonly FlatMenuNode[],
  collapsedMenuIds: ReadonlySet<string>
): FlatMenuNode[] {
  const visibleRows: FlatMenuNode[] = [];
  const collapsedAncestorDepths: number[] = [];

  for (const menu of rows) {
    while (
      collapsedAncestorDepths.length > 0 &&
      menu.depth <= collapsedAncestorDepths[collapsedAncestorDepths.length - 1]
    ) {
      collapsedAncestorDepths.pop();
    }

    if (collapsedAncestorDepths.length > 0) {
      continue;
    }

    visibleRows.push(menu);

    if (collapsedMenuIds.has(getMenuNodeStableId(menu))) {
      collapsedAncestorDepths.push(menu.depth);
    }
  }

  return visibleRows;
}

export function deptSelectOptions(
  nodes: readonly DeptRspDTO[] = [],
  options?: { enabledOnly?: boolean }
) {
  return flattenDeptTree(nodes)
    .filter((dept) => !options?.enabledOnly || dept.status === 'ENABLED')
    .map((dept) => ({
      value: String(dept.deptId ?? ''),
      label: prefixLabel(dept.depth, dept.deptName ?? dept.deptCode ?? String(dept.deptId ?? '')),
      disabled: options?.enabledOnly && dept.status !== 'ENABLED'
    }))
    .filter((option) => option.value);
}

export function deptMultiSelectOptions(
  nodes: readonly DeptRspDTO[] = []
): MultiSelectComboboxOption[] {
  return deptSelectOptions(nodes).map((option) => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled
  }));
}

export function menuSelectOptions(nodes: readonly MenuRspDTO[] = [], excludeMenuId?: number) {
  return flattenMenuTree(nodes)
    .filter(
      (menu) => menu.menuId != null && menu.menuId !== excludeMenuId && menu.menuType !== 'BUTTON'
    )
    .map((menu) => ({
      value: String(menu.menuId),
      label: prefixLabel(menu.depth, menu.menuName ?? menu.menuCode ?? String(menu.menuId))
    }));
}

export function menuMultiSelectOptions(
  nodes: readonly MenuRspDTO[] = []
): MultiSelectComboboxOption[] {
  return flattenMenuTree(nodes)
    .filter((menu) => menu.menuId != null)
    .map((menu) => ({
      value: String(menu.menuId),
      label: prefixLabel(menu.depth, `${menu.menuName ?? menu.menuCode ?? menu.menuId}`)
    }));
}
