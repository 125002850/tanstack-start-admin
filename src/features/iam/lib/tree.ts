import type { MultiSelectComboboxOption } from '@/components/ui/multi-select-combobox';
import type { DeptRspDTO, MenuRspDTO } from '@/lib/api/clients/service';

type TreeLike<TNode> = TNode & {
  children?: Array<TreeLike<TNode>>;
};

type FlatNode<TNode> = TNode & {
  depth: number;
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
  return flattenTree<MenuRspDTO>(nodes as readonly TreeLike<MenuRspDTO>[]);
}

export function deptSelectOptions(nodes: readonly DeptRspDTO[] = [], options?: { enabledOnly?: boolean }) {
  return flattenDeptTree(nodes)
    .filter((dept) => !options?.enabledOnly || dept.status === 'ENABLED')
    .map((dept) => ({
      value: String(dept.deptId ?? ''),
      label: prefixLabel(dept.depth, dept.deptName ?? dept.deptCode ?? String(dept.deptId ?? '')),
      disabled: options?.enabledOnly && dept.status !== 'ENABLED'
    }))
    .filter((option) => option.value);
}

export function deptMultiSelectOptions(nodes: readonly DeptRspDTO[] = []): MultiSelectComboboxOption[] {
  return deptSelectOptions(nodes).map((option) => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled
  }));
}

export function menuSelectOptions(nodes: readonly MenuRspDTO[] = [], excludeMenuId?: number) {
  return flattenMenuTree(nodes)
    .filter((menu) => menu.menuId != null && menu.menuId !== excludeMenuId)
    .map((menu) => ({
      value: String(menu.menuId),
      label: prefixLabel(menu.depth, menu.menuName ?? menu.menuCode ?? String(menu.menuId))
    }));
}

export function menuMultiSelectOptions(nodes: readonly MenuRspDTO[] = []): MultiSelectComboboxOption[] {
  return flattenMenuTree(nodes)
    .filter((menu) => menu.menuId != null)
    .map((menu) => ({
      value: String(menu.menuId),
      label: prefixLabel(menu.depth, `${menu.menuName ?? menu.menuCode ?? menu.menuId}`)
    }));
}
