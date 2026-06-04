# Workspace Tags Bar 拖动排序设计

## 文档定位

这份文档是 **design spec**，负责定义 `TagsBar` 拖动排序的产品语义、技术边界和回归约束；它不是 implementation plan。

配套的可执行计划单独存放于：

- `docs/plans/2026-06-04-tags-bar-drag-sort.md`

这样分离的目的很直接：

- spec 负责说明“为什么这样设计、哪些行为必须成立”
- plan 负责说明“按什么顺序改哪些文件、怎么验证”

## 目标

为 `src/components/layout/tags-bar.tsx` 增加一个仅作用于当前会话的标签拖动排序能力：

- 非首页 tag 支持长按后拖动调整显示顺序
- 长按激活后，原位置进入 Ghost 占位态，拖动实体以浮层方式跟随指针
- 首页 tag 永远固定在第一位，不参与拖拽，也不成为任何交换目标
- 排序结果只影响当前 `TagsBar` 挂载周期内的显示顺序，不写入 store，不做刷新后持久化
- 交互风格在不同主题下都沿用现有 tag 的视觉语义，不引入突兀的独立皮肤

## 非目标

本次设计 **不** 包含以下范围：

- 不新增 `workspace` store 的 reorder action
- 不持久化排序到 localStorage、URL、服务端或任何跨刷新状态
- 不支持首页 tag 的拖动、交换、关闭或位置调整
- 不新增键盘拖拽排序语义；现有键盘左右切换、`Enter` 激活、`Delete` 关闭仍保持原样
- 不改动 `useWorkspaceTags()` 的对外接口
- 不迁移 `TagsBar` 为多文件目录结构；运行时代码保持单文件实现

## 交互规格

| 行为 | 说明 |
|------|------|
| 默认状态 | 按 `openedOrder` 渲染，首页固定第一位 |
| 可拖动范围 | 仅非首页 tag 可拖动，且只能在非首页序列内部调整顺序 |
| 桌面端起手 | 鼠标主键按下后进入长按等待；建议阈值 `180ms`，容忍位移 `8px` |
| 长按失败 | 在阈值前松手，按普通点击处理；在阈值前发生明显移动，取消拖动准备并保留普通点击语义 |
| 长按成功 | 进入拖动态；原位置显示 Ghost 占位，拖动实体浮起并跟随指针 |
| 排序反馈 | 经过其他非首页 tag 时，其余 tag 以 transform 让位动画平滑滑开 |
| 拖到首页附近 | 不与首页交换，也不能落到首页前面；首页始终停留在第一位 |
| 拖动结束 | 更新当前会话内的 `visualOrder`，不改变 store 中的 `openedOrder` |
| 拖动取消 | 恢复拖前顺序，不触发页面切换 |
| 拖动后的 click | 一次真实拖拽完成后必须抑制同次 pointer 序列产生的激活 click，避免误切页 |
| 新开 tag | 新打开的非首页 tag 追加到当前 `visualOrder` 尾部 |
| 关闭 tag | 从当前 `visualOrder` 移除该 tag；其余顺序保持 |
| 页面刷新 | 排序丢失，恢复默认打开顺序 |

## 状态模型

### 1. `openedOrder` 仍是成员集合真相源

`src/features/workspace-tabs/utils/store.ts` 中的 `openedOrder` 继续只表达：

- 当前有哪些 tag 处于打开状态
- 这些 tag 的默认打开顺序
- 首页始终在首位的归一化结果

本次能力 **不** 改写这层语义。

首页 id 的识别应继续复用现有路由 helper（`resolveDashboardHomeHref()` / `isDashboardHomeHref()`），而不是在 `TagsBar` 内再引入新的首页判定常量。

### 2. `visualOrder` 是 `TagsBar` 内部的临时显示顺序

`TagsBar` 内新增本地状态 `visualOrder`，仅用于当前组件实例的渲染顺序。

约束如下：

- 初始值来自 `openedOrder`
- 首页 id 永远被强制放在第一位
- 拖动成功后，只重排非首页区间
- 组件卸载后自然丢弃

### 3. `visualOrder` 与 `openedOrder` 的 reconcile 规则

当 store 变化导致 `openedOrder` 更新时，`TagsBar` 必须执行一次集合对齐：

1. 保留当前 `visualOrder` 中仍然存在于 `openedOrder` 的非首页 id，相对顺序不变
2. 移除已经关闭的 id
3. 将新出现但尚未存在于 `visualOrder` 的非首页 id 追加到尾部
4. 将首页 id 重新拼回第一位

这条规则的目标不是“记住全局排序”，而是：

- 在当前会话里尽量尊重用户刚拖出来的视觉顺序
- 同时保证新开/关闭 tag 后不会出现缺失、重复或首页移位

## 关键架构决策

### 1. 使用 `dnd-kit + 本地 visualOrder`，不直接重排 store

本设计明确采用 `方案 1`：

- 复用项目已有的 `@dnd-kit/core` / `@dnd-kit/sortable`
- 排序结果仅写入 `TagsBar` 本地状态
- 不新增 `useWorkspaceTabStore` 的 reorder action

原因：

- 需求已明确“不持久化，刷新后恢复默认”
- `openedOrder` 是 workspace runtime 的共享契约，不应混入纯视图层顺序
- 该方案对现有 `openOrActivate / close / closeOther / closeAll` 的回归风险最低

### 2. 首页从结构上排除在 sortable 集合外

首页 tag 不是“可拖动但被禁止交换”，而是 **根本不进入 sortable items**。

这意味着：

- 首页不挂任何 sortable listeners / attributes
- 首页不参与碰撞计算
- 非首页 drag end 时只对非首页数组执行 `arrayMove`

这样可以在结构层面保证“首页永远第一位”，而不是把约束留给运行时补丁兜底。

### 3. 长按触发由 sensor 激活约束负责，不手写整套 pointer 状态机

本设计优先使用 `MouseSensor` 与 `TouchSensor` 的 `activationConstraint`：

- `delay: 180`
- `tolerance: 8` 到 `12`

原因：

- 这与 `dnd-kit` 的原生激活模型一致
- 可以把“短按激活 tab”和“长按进入拖动”放进同一输入序列里处理
- 避免为单一横向标签栏重写一套自定义 pointer 状态机

### 4. 键盘排序不纳入本次范围，避免与现有 tab 键盘语义冲突

当前 `TagsBar` 已有明确键盘契约：

- `ArrowLeft` / `ArrowRight` 在标签间移动焦点
- `Enter` 激活当前 tag
- `Delete` 关闭当前 tag

如果同时引入 `KeyboardSensor`，会把键盘从“标签导航”变成“拖拽排序”，与现有行为冲突。本次设计因此明确：

- 保留现有 tab 键盘语义
- 不新增键盘拖拽排序

### 5. 运行时代码保持单文件，但在文件内按语义拆边界

`src/components/layout/tags-bar.tsx` 保持单文件实现，但需要在文件内形成清晰边界：

- `TagsBar`：读 store、维护 `visualOrder`、挂 `DndContext`
- `PinnedHomeTag`：首页专用渲染分支
- `SortableTagItem`：非首页排序项
- 纯 helper：`isHomeTag()`、`reconcileVisualOrder()`、`rebuildVisualOrder()` 等

这不是为了追求“文件最少”，而是为了在满足你“单文件实现”的前提下，把职责边界拉直。

## 事件与交互边界

### 点击与拖拽的边界

- 短按非首页 tag：仍然执行 `openOrActivate`
- 长按成功后再拖动：只改变显示顺序，不改变 `activeId`
- 真实发生拖拽后，必须抑制本次 pointer 序列后续的 click 激活

### 关闭按钮边界

关闭按钮当前只在 `click` 时 `stopPropagation()` 还不够，因为长按拖拽是从 `mousedown` / `touchstart` 激活的。

因此关闭按钮必须额外阻断：

- `onMouseDown`
- `onPointerDown` 或 `onTouchStart`

否则用户在 close icon 上按住时会错误进入拖动准备态。

### 右键菜单边界

右键上下文菜单语义保持不变：

- 右键不会触发拖拽
- 右键目标仍是对应 tag
- “刷新页面 / 关闭标签 / 关闭其他标签 / 关闭所有标签” 行为不受排序能力影响

## 动画与主题规格

### Ghost 占位

原位置占位态必须满足：

- 宽高与被拖 tag 一致
- 保留现有圆角与边界语义
- 内容对比度弱化，但不完全透明
- 可通过稳定 selector 暴露给测试

### 拖动实体

拖动浮层必须满足：

- 视觉上延续当前 tag 的主题语义，而不是硬编码另一套配色
- 允许轻微缩放、浮起阴影和透明度变化
- 不做夸张弹跳或与主题不一致的炫技动画

### 其他 tag 让位动画

其余 tag 的让位动画应以 `transform + transition` 为主，目标是“滑动让位”，不是“跳位”。

### 自动滚动

拖动靠近 ScrollArea viewport 左右边缘时，标签栏应自动水平滚动，保证长标签列表仍可完成跨可视区排序。

## DOM 与测试钩子契约

为了让 RTL 与 Playwright 稳定验证，本设计要求新增稳定 DOM 钩子：

- taglist 容器：`data-slot="workspace-tags-bar"`
- 普通 tag：`data-slot="workspace-tag"`
- 拖动浮层：`data-slot="workspace-tag-overlay"`
- 原位 Ghost 占位：`data-slot="workspace-tag-placeholder"`
- 首页固定标记：`data-pinned="home"`

同时保留现有：

- `role="tablist"`
- `role="tab"`
- `data-tab-id`

这些钩子是回归测试契约的一部分，不应在实现时随意改名。

## 影响文件边界

### 运行时代码

- `src/components/layout/tags-bar.tsx`

### 单元测试

- `src/components/layout/tags-bar.test.tsx`

### 浏览器 smoke

- `e2e/tags-bar-drag-sort.smoke.spec.ts`

### 参考实现

- `src/components/ui/kanban.tsx`
- `src/features/workspace-tabs/hooks/use-workspace-tags.ts`
- `src/features/workspace-tabs/utils/store.ts`

## 验收标准

以下结果必须同时成立，才算本设计被正确实现：

1. 首页 tag 永远固定在第一位，任何拖动都不能跨过它。
2. 非首页 tag 仅在长按成功后进入拖动态；短按仍然是正常切页。
3. 拖动完成后，只更新当前 `TagsBar` 的显示顺序，不改 store 的 `openedOrder` 语义。
4. 新开 tag 会在当前会话的视觉顺序尾部追加；关闭 tag 会从视觉顺序移除。
5. 现有键盘导航、关闭按钮、dirty 指示点、context menu、左右 fade 不回归。
6. 拖动浮层与占位态在不同主题下都不突兀，并能通过自动化测试稳定识别。
