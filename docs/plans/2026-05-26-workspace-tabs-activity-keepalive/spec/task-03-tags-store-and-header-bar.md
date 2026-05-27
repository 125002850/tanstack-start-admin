# Task 03: Tags Store 与 Header 标签条

**Depends on:** `Task 01, Task 02`
**Blocks:** `Task 05`
**Type:** `behavior`

## Goal

实现纯内存的 workspace tag 状态机、route 到 tag 的同步钩子，以及挂在 `Header` 左侧的 `TagsBar` UI。

## Files

- Create: `src/features/workspace-tabs/types.ts`
- Create: `src/features/workspace-tabs/utils/store.ts`
- Create: `src/features/workspace-tabs/hooks/use-workspace-tags.ts`
- Create: `src/features/workspace-tabs/hooks/use-dashboard-route-tag-sync.ts`
- Create: `src/features/workspace-tabs/hooks/use-dashboard-route-tag-sync.test.ts`
- Create: `src/components/layout/tags-bar.tsx`
- Create: `src/features/workspace-tabs/utils/store.test.ts`
- Create: `src/components/layout/tags-bar.test.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/routes/dashboard.tsx`
- Reference: `src/components/ui/context-menu.tsx`
- Reference: `src/components/ui/scroll-area.tsx`
- Reference: `src/lib/router/dashboard-home.ts`

## Invariants

- `Header` 右侧 `SearchInput / Theme / NotificationCenter` 位置与功能不变。
- 首页 tag 必须始终存在且不可关闭。
- store 本身不得直接 import router；导航、副作用和刷新事务要放在 `useWorkspaceTags()` 中。

## Constraints

- `TagsBar` 只负责 tag chrome，不负责 keep-alive 渲染。
- `openedOrder` 只用于展示顺序；关闭当前 tag 的回退目标只能依据 `lastVisitedAt`。
- `useDashboardRouteTagSync()` 只同步最深 route 的 tag，不把 layout route 注入 tags。
- `useDashboardRouteTagSync()` 只负责 tag 的 open/activate/title/closable/keepAlive 标记同步；不得注册 descriptor，也不得承担 screen 渲染职责。

## Acceptance Criteria

- [ ] `bunx vitest run src/features/workspace-tabs/utils/store.test.ts src/features/workspace-tabs/hooks/use-dashboard-route-tag-sync.test.ts src/components/layout/tags-bar.test.tsx` 通过
- [ ] `bun run build` 通过
- [ ] `Header` 左侧结构变为 `SidebarTrigger + Separator + TagsBar`，且 `TagsBar` 占用剩余宽度
- [ ] `use-dashboard-route-tag-sync` 测试覆盖首页 tag 不可关闭与 URL 变化触发 open/activate

## Verification Strategy

`behavior` 任务使用单测 + 受限手工检查。状态机、sync hook 与键盘/禁用语义可自动化，横向溢出和 header 布局需要浏览器实际观察。

## Manual Verification Exception

- `Waiver Reason:` `TagsBar` 的横向占位、渐隐遮罩和 header 不挤压右侧 controls 属于布局集成问题，组件测试不能完全覆盖。
- `Automated Smoke Check:` `bunx vitest run src/features/workspace-tabs/utils/store.test.ts src/features/workspace-tabs/hooks/use-dashboard-route-tag-sync.test.ts src/components/layout/tags-bar.test.tsx && bun run build`
- `Manual Verification Steps:` 启动 `bun run dev`，访问 `/dashboard/overview`，确认 header 左侧出现首页 tag；再访问 `/dashboard/chat`，确认新 tag 加入且右侧 controls 没有换行或被压缩。
- `Expected Results:` 首页 tag 不显示关闭入口；切换到聊天页后 tags 可以横向滚动，右侧搜索和主题切换按钮仍在原位置。
- `Follow-up Automation:` `not needed`，核心行为已由状态机和组件测试覆盖，剩余检查是纯布局集成。

## Execution Recipe

1. 在 `types.ts` 中定义 `WorkspaceTab`、`WorkspaceTagId`、`WorkspaceTagSnapshot` 等纯数据类型。
2. 在 `store.ts` 中实现纯内存 Zustand store，并为 `openOrActivate`、`close`、`closeOther`、`closeAll`、`touch`、`evictInactive` 编写单测。
3. 在 `use-workspace-tags.ts` 中封装 `navigate()`、首页保护、回退规则和刷新入口。
4. 实现 `use-dashboard-route-tag-sync.ts`，从当前 location + deepest route staticData 推导 title、href、closable 和 keepAlive 标记。
5. 新建 `use-dashboard-route-tag-sync.test.ts`，至少覆盖：
   - 首页 href 映射为不可关闭 tag
   - 非首页 route 触发 openOrActivate
   - URL 从一个 dashboard 子路由切到另一个时 activeTag 跟随切换
6. 在 `tags-bar.tsx` 中使用现有 `ContextMenu`/`ScrollArea` 组件渲染 roving-focus 标签条，并接入右键菜单动作。
7. 修改 `header.tsx` 与 `dashboard.tsx`，挂载 `TagsBar` 与 route sync hook。
8. 运行 `bunx vitest run src/features/workspace-tabs/utils/store.test.ts src/features/workspace-tabs/hooks/use-dashboard-route-tag-sync.test.ts src/components/layout/tags-bar.test.tsx`、`bun run build`，再做手工布局检查。
9. 提交建议：`git commit -m "feat: add workspace tags bar state and ui"`

## Notes For Executor

- `TagsBar` 当前只显示 route title，不在这一层引入页面描述、图标或 drag reorder。
- 键盘测试至少覆盖 `ArrowLeft/ArrowRight`、`Enter`、`Delete`、`Shift+F10` 四类输入。
