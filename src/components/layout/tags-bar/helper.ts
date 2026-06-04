import type { WorkspaceTabId } from '@/features/workspace-tabs/types';
import { cn } from '@/lib/utils';
import { HOME_ID } from './constant';

// 首页标签在排序、关闭、拖拽等流程里都有特殊语义，因此抽成独立判断。
export function isHomeTag(id: WorkspaceTabId) {
  return id === HOME_ID;
}

// visualOrder 是前端拖拽时的临时排序，openedOrder 是 store 中的真实排序。
// 这个函数负责把两者重新对齐，同时确保：
// 1. 首页标签始终固定在最前；
// 2. 已关闭的标签会被剔除；
// 3. 新开的标签会以 store 顺序补到末尾。
export function reconcileVisualOrder(
  openedOrder: WorkspaceTabId[],
  currentVisualOrder: WorkspaceTabId[]
) {
  const hasHome = openedOrder.includes(HOME_ID);
  const openedNonHomeIds = openedOrder.filter((id) => !isHomeTag(id));
  const kept = currentVisualOrder.filter((id) => !isHomeTag(id) && openedNonHomeIds.includes(id));
  const appended = openedNonHomeIds.filter((id) => !kept.includes(id));

  return hasHome ? [HOME_ID, ...kept, ...appended] : [...kept, ...appended];
}

// 拖拽上下文只允许普通标签参与排序，首页标签必须被排除。
export function getNonHomeVisualOrder(order: WorkspaceTabId[]) {
  return order.filter((id) => !isHomeTag(id));
}

// a11y 播报统一使用这个位置文案，避免各处各写一份中文描述。
export function getPositionLabel(position: number, total: number) {
  return `第 ${position} / ${total} 个位置`;
}

// 普通标签按钮的视觉样式。
// active 态和 inactive 态都集中在这里，避免组件层散落条件判断。
export function getTagButtonClassName(isActive: boolean) {
  return cn(
    'group inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-2.5 text-xs transition-colors',
    'hover:text-foreground',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    isActive
      ? 'bg-card text-card-foreground shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.12)]'
      : 'text-muted-foreground'
  );
}

// 占位标签故意保留与真实标签近似的尺寸与节奏，但视觉上降级为虚线框。
// 这样既能提示“这里原来有个标签”，又不会被误认成真实可交互元素。
export function getPlaceholderClassName(isActive: boolean) {
  return cn(
    'inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-dashed px-2.5 text-xs',
    isActive
      ? 'border-border/80 bg-card/70 text-card-foreground/70'
      : 'border-border/70 bg-muted/35 text-muted-foreground/70'
  );
}
