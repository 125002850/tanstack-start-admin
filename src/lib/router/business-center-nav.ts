import type { NavGroup, NavItem } from '@/types';

function flatten(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((item) => [
    ...(item.linkable === false ? [] : [{ ...item, items: undefined }]),
    ...flatten(item.items ?? [])
  ]);
}

/** 在权限过滤后将旧 kind/parentId 树投影为业务中心 + 功能两级导航。 */
export function buildBusinessCenterNav(groups: readonly NavGroup[]): NavItem[] {
  return groups.flatMap((group) => {
    const items = flatten(group.items);
    if (!items.length) return [];
    if (!group.label) return items;
    return [
      {
        id: `center:${group.label}`,
        title: group.label,
        url: '',
        linkable: false,
        icon: group.items.find((item) => item.icon)?.icon,
        items
      }
    ];
  });
}
