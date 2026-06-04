# TagsBar 标签拖动排序 Implementation Plan

**Goal:** 为 `src/components/layout/tags-bar.tsx` 增加基于 `dnd-kit` 的长按拖动排序能力，满足“首页固定第一、仅当前会话生效、Ghost 占位、丝滑动画、现有标签行为零回归”。

**Architecture:** `openedOrder` 继续作为 workspace tabs 的成员集合真相源，`TagsBar` 在本地维护一个 `visualOrder` 作为当前会话内的显示顺序；首页 tag 结构性排除在 sortable 集合外，非首页 tag 通过 `MouseSensor` / `TouchSensor` 的长按激活进入拖动态，排序结果仅写回本地状态并在 store 变化时按 reconcile 规则对齐。

**Tech Stack:** React 19、TypeScript、`@dnd-kit/core`、`@dnd-kit/sortable`、Vitest、Testing Library、Playwright

---

## File Structure

- Create: `e2e/tags-bar-drag-sort.smoke.spec.ts`
- Modify: `src/components/layout/tags-bar.tsx`
- Modify: `src/components/layout/tags-bar.test.tsx`
- Reference: `docs/superpowers/specs/2026-06-04-tags-bar-drag-sort-design.md`
- Reference: `src/components/ui/kanban.tsx`
- Reference: `src/features/workspace-tabs/hooks/use-workspace-tags.ts`
- Reference: `src/features/workspace-tabs/utils/store.ts`

---

### Task 0: 浏览器预检与 drag smoke 骨架

**Type:** `infra`

**Files**

- Create: `e2e/tags-bar-drag-sort.smoke.spec.ts`

**Shared Runtime Contracts**

- `none`

**Invariants**

- 该 task 只验证 workspace tags bar 的页面可达性、基础 selector 和多标签准备路径
- 不在本 task 中验证最终拖动排序业务结果

**Constraints**

- 必须在第一个 behavior task 之前完成
- 新增 Playwright 用例必须复用现有 `@workspace-v2` 项目标签体系
- 禁止使用无理由的 `waitForTimeout`；必须等待 URL、role 或稳定 `data-slot`

**Acceptance Criteria**

- [ ] `profile: task-0-browser-preflight` 通过
- [ ] `/dashboard/product` 页面可稳定打开并渲染 `Workspace tabs`
- [ ] smoke 骨架已提供后续 drag 测试所需的辅助函数和稳定 selector
- [ ] 预检确认首页 tab 默认在第一位

**Verification Profile**

- `profile: task-0-browser-preflight`
  - `pnpm run test:e2e:smoke -- e2e/tags-bar-drag-sort.smoke.spec.ts --grep @preflight`
- `Expected Signals:` Playwright 成功启动 workspace servers，能进入产品页、打开额外标签并断言 tablist 可见；失败时应定位为环境、路由或 selector 问题，而不是拖拽业务问题。

**Verification Strategy**

- `build + smoke`

**Browser Gate Role**

- `preflight`

- [ ] Step 1: 新建 `e2e/tags-bar-drag-sort.smoke.spec.ts`，写入 `@preflight @workspace-v2` 用例和以下辅助函数：`gotoProduct(page)`、`openUsers(page)`、`openChat(page)`、`workspaceTabs(page)`、`tabTexts(page)`
- [ ] Step 2: 在预检里验证：
  - `page.getByRole('tablist', { name: 'Workspace tabs' })` 可见
  - 至少能打开 `产品`、`用户`、`聊天` 三个标签
  - 首个 tab 文本为 `仪表盘`
- [ ] Step 3: Run `profile: task-0-browser-preflight`
- [ ] Step 4: Commit `test: add tags bar drag sort browser preflight`

---

### Task 1: 为长按拖动引入最小回归护栏

**Type:** `behavior`

**Files**

- Modify: `src/components/layout/tags-bar.test.tsx`

**Shared Runtime Contracts**

- workspace tags 的点击、关闭、键盘导航边界
- 首页固定与非首页可拖动边界

**Invariants**

- `role="tablist"` / `role="tab"` 语义保持不变
- 现有 `ArrowLeft` / `ArrowRight` / `Enter` / `Delete` 行为保持可用
- 首页仍不可关闭
- 本 task 只增加回归用例，不修改运行时代码

**Constraints**

- 不得通过 mock `dnd-kit` 内部实现来“伪造通过”
- 新增用例必须复用现有 store mock 方案
- 对长按时间边界使用 fake timers，而不是裸 `setTimeout`
- 测试约束以 DOM 结果和 store 结果为准，不测试实现细节变量名

**Acceptance Criteria**

- [ ] `profile: task-1-regression-guard` 在实现前先失败，再在实现后转绿
- [ ] 新增测试覆盖首页固定标记、短按仍激活、关闭按钮不会进入拖动准备态
- [ ] 现有标签键盘与关闭行为回归测试仍全部通过

**Verification Profile**

- `profile: task-1-regression-guard`
  - `pnpm exec vitest run src/components/layout/tags-bar.test.tsx`
- `Expected Signals:` 新增测试在实现前至少有一条红灯；实现完成后全绿，且已有 `TagsBar` 测试不回归。

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

**Implementation Notes**

建议先把需要锁住的 DOM 契约写进测试断言：

```tsx
expect(screen.getByRole('tab', { name: /仪表盘/ })).toHaveAttribute('data-pinned', 'home');
expect(screen.getByRole('tab', { name: /Chat/ })).toHaveAttribute('data-slot', 'workspace-tag');
expect(document.querySelector('[data-slot="workspace-tag-overlay"]')).toBeNull();
```

- [ ] Step 1: 在 `src/components/layout/tags-bar.test.tsx` 增加以下用例：
  - 首页 tag 带 `data-pinned="home"`，且不显示 sortable 标记
  - 非首页 tag 带稳定 `data-slot="workspace-tag"` / `data-tab-id`
  - 短按非首页 tag 仍会更新 `activeId`
  - close icon 的 `mouseDown` / `pointerDown` 不会触发拖动占位或阻断关闭
- [ ] Step 2: Run `profile: task-1-regression-guard`，确认实现前出现预期失败
- [ ] Step 3: Commit `test: add tags bar drag sort regression guards`

---

### Task 2: 在单文件 `TagsBar` 中实现本地 drag sort

**Type:** `behavior`

**Files**

- Modify: `src/components/layout/tags-bar.tsx`
- Modify: `src/components/layout/tags-bar.test.tsx`

**Shared Runtime Contracts**

- workspace tag 的显示顺序与 store `openedOrder` 的集合边界
- active route / active tab 切换语义
- close button 与 context menu 的事件边界

**Invariants**

- 不改 `useWorkspaceTags()` 的返回值和 store action 语义
- 首页永远第一位，且不可拖动
- 真实拖拽不会触发 route 切换
- 新开标签追加到视觉顺序尾部；关闭标签从视觉顺序移除
- 当前 `showLeftFade` / `showRightFade`、`scrollIntoView`、dirty 指示点和 context menu 继续工作

**Constraints**

- 运行时代码必须保持在 `src/components/layout/tags-bar.tsx` 单文件内
- 不新增 store reorder action，不改 `src/features/workspace-tabs/utils/store.ts`
- 不引入 `KeyboardSensor`，避免覆盖现有 tab 键盘语义
- 必须为浏览器测试暴露稳定钩子：
  - `data-slot="workspace-tags-bar"`
  - `data-slot="workspace-tag"`
  - `data-slot="workspace-tag-overlay"`
  - `data-slot="workspace-tag-placeholder"`
  - `data-pinned="home"`
- close button 必须额外阻断 `onMouseDown` 与 `onPointerDown`，不能只拦 `click`

**Acceptance Criteria**

- [ ] `profile: task-2-tags-bar-core` 通过
- [ ] `visualOrder` 只在本地维护，store `openedOrder` 不被改写
- [ ] 长按成功后出现 Ghost 占位和拖动浮层
- [ ] drag end 仅重排非首页顺序；drag cancel 不改顺序
- [ ] 拖动结束后不误切换到 source 或 target 页
- [ ] 新开 tag 会在当前视觉顺序尾部追加

**Verification Profile**

- `profile: task-2-tags-bar-core`
  - `pnpm exec vitest run src/components/layout/tags-bar.test.tsx`
  - `pnpm exec oxlint src/components/layout/tags-bar.tsx src/components/layout/tags-bar.test.tsx`
- `Expected Signals:` `TagsBar` 测试全绿，lint 对新增 `dnd-kit`、事件处理和 data 属性无报错。

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

**Implementation Recipe**

推荐在同文件内引入以下状态与 helper：

```ts
const LONG_PRESS_DELAY_MS = 180;
const HOME_ID = resolveDashboardHomeHref();

function isHomeTag(id: WorkspaceTabId) {
  return id === HOME_ID;
}

function reconcileVisualOrder(
  openedOrder: WorkspaceTabId[],
  currentVisualOrder: WorkspaceTabId[]
) {
  const [homeId, ...openedNonHomeIds] = openedOrder;
  const kept = currentVisualOrder.filter(
    (id) => id !== homeId && openedNonHomeIds.includes(id)
  );
  const appended = openedNonHomeIds.filter((id) => !kept.includes(id));
  return homeId ? [homeId, ...kept, ...appended] : [...kept, ...appended];
}

const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { delay: LONG_PRESS_DELAY_MS, tolerance: 8 }
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: LONG_PRESS_DELAY_MS, tolerance: 12 }
  })
);
```

拖动完成时只操作非首页数组：

```ts
const nonHomeIds = visualOrder.filter((id) => !isHomeTag(id));
const from = nonHomeIds.indexOf(activeId);
const to = nonHomeIds.indexOf(overId);
const nextNonHomeIds = arrayMove(nonHomeIds, from, to);
setVisualOrder([homeId, ...nextNonHomeIds]);
```

- [ ] Step 1: 在 `tags-bar.tsx` 中新增 `dnd-kit` 依赖、`visualOrder`、`activeDragId`、`dragOverlayWidth`、`suppressClickRef` 以及 `reconcileVisualOrder()` / `isHomeTag()` helper
- [ ] Step 2: 把首页渲染与非首页渲染拆成文件内子组件 `PinnedHomeTag` 与 `SortableTagItem`，但仍保留单文件
- [ ] Step 3: 用 `DndContext + SortableContext + DragOverlay` 包裹非首页 tag，采用 `horizontalListSortingStrategy`
- [ ] Step 4: 在 `SortableTagItem` 内把 `useSortable()` 的 `transform` / `transition` 映射到现有 tag UI，并为 `isDragging` 状态渲染 Ghost 占位与 overlay clone
- [ ] Step 5: 对 close icon 增加 `onMouseDown` / `onPointerDown` 的 `stopPropagation()`，并在真实拖拽结束后抑制同次 click 导航
- [ ] Step 6: 让 `openedOrder` 变化时通过 `useEffect` 执行 reconcile，确保“新开追加、关闭移除”
- [ ] Step 7: Run `profile: task-2-tags-bar-core`
- [ ] Step 8: Commit `feat: add local drag sort for workspace tags`

---

### Task 3: 浏览器级回归与共享契约审计

**Type:** `wiring`

**Files**

- Modify: `e2e/tags-bar-drag-sort.smoke.spec.ts`

**Shared Runtime Contracts**

- workspace tag 显示顺序
- active route 切换语义
- 首页固定第一位
- 新开/关闭 tag 后的视觉顺序 reconcile

**Invariants**

- 拖动排序后，`activeId` 对应页面不应因 drop 误跳转
- 首页必须始终显示在第一位
- 排序结果只影响当前会话；本 task 不验证刷新后保留
- context menu 和 close 行为不得因 draggable 包装失效

**Constraints**

- 必须用真实浏览器指针序列验证长按后拖动，不能仅依赖 RTL
- 不得用脆弱文本链式等待；优先使用 `role`、URL 和 `data-slot`
- smoke 要覆盖至少一次“拖动后再新开标签”的 reconcile 路径

**Acceptance Criteria**

- [ ] `profile: task-3-browser-smoke` 通过
- [ ] 长按拖动后非首页顺序在浏览器中更新，首页仍在第一位
- [ ] 一次真实拖拽不会误触发页面切换
- [ ] 拖动后再打开新页面，新 tag 会追加到当前视觉顺序尾部
- [ ] close button 与 context menu 至少完成一次回归断言

**Verification Profile**

- `profile: task-3-browser-smoke`
  - `pnpm run test:e2e:smoke -- e2e/tags-bar-drag-sort.smoke.spec.ts --grep @workspace-v2`
- `Expected Signals:` Playwright 在 workspace-v2 项目下通过所有 `tags-bar-drag-sort` 用例，能够稳定完成长按、拖动、排序断言和新开标签追加断言。

**Verification Strategy**

- `integration smoke`

**Browser Gate Role**

- `regression`

**Implementation Notes**

建议在 smoke 文件中提供一个真实长按拖动 helper：

```ts
async function longPressDragTab(page: Page, tab: Locator, deltaX: number) {
  const box = await tab.boundingBox();
  if (!box) throw new Error('tab bounding box unavailable');

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(220);
  await page.mouse.move(x + deltaX, y, { steps: 12 });
  await page.mouse.up();
}
```

这里允许 `waitForTimeout(220)`，因为它对应产品定义里的长按阈值验证，不是任意等待。

- [ ] Step 1: 扩展 `e2e/tags-bar-drag-sort.smoke.spec.ts`，新增以下用例：
  - 长按拖动 `用户` 与 `聊天` 调整顺序，首页仍第一位
  - drag end 后 URL 保持在拖动前的 active 页面
  - 拖动后打开一个新页面，例如 `通知`，断言新 tag 追加到当前视觉顺序尾部
  - 拖动完成后点击 close icon 或右键 context menu，确认关闭能力未回归
- [ ] Step 2: Run `profile: task-3-browser-smoke`
- [ ] Step 3: Commit `test: add tags bar drag sort browser regression smoke`

---

## Final Verification

- `pnpm exec vitest run src/components/layout/tags-bar.test.tsx`
- `pnpm run test:e2e:smoke -- e2e/tags-bar-drag-sort.smoke.spec.ts --grep @workspace-v2`
- `pnpm lint`

**Expected final signal:** `TagsBar` 单测、drag sort 浏览器 smoke 和全量 lint 全部通过；首页固定第一、长按拖动排序、新开追加和关闭回归都被自动化覆盖。

---

保存路径：

- `docs/superpowers/specs/2026-06-04-tags-bar-drag-sort-design.md`
- `docs/plans/2026-06-04-tags-bar-drag-sort.md`

推荐执行方式：

1. `executing-plans`
适合这份单文件线性计划，按 Task 0 -> 3 顺序在同一会话内推进。

2. `subagent-driven-development`
如果你想把 `Task 1` 的测试护栏和 `Task 3` 的浏览器 smoke 分给独立执行者并在中间做 review，可以切到这个模式。
