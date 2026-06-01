# DataTable 行展开底部面板 Implementation Plan

**Goal:** 为通用 `DataTable` 增加一个可选的行展开底部面板能力，并在 `/dashboard/users` 完成首个真实消费方落地，同时保持未启用页面零回归。

**Architecture:** 展开态以 `rowKey` 驱动，而不是 TanStack 默认 `row.id`；pointer 用户通过 selector-based row click 展开，keyboard / screen reader 用户通过自动生成的 disclosure button 列触发相同行为；上下布局使用像素精确的自定义 vertical splitter，并把高度计算抽到纯函数工具中单测，避免把 `200px / 150px` 约束偷换成百分比近似值。

**Tech Stack:** React 19、TypeScript、@tanstack/react-table v8、Vitest、Testing Library、Playwright

---

## File Structure

- **Create:** `e2e/data-table-row-expand.smoke.spec.ts`
- **Create:** `src/components/ui/table/data-table-expand-panel.tsx`
- **Create:** `src/components/ui/table/data-table-expand-trigger.tsx`
- **Create:** `src/lib/data-table-expand-split.ts`
- **Create:** `src/lib/data-table-expand-split.test.ts`
- **Create:** `src/features/users/components/users-table/expand-config.tsx`
- **Modify:** `src/types/data-table.ts`
- **Modify:** `src/hooks/use-data-table.ts`
- **Modify:** `src/components/ui/table/data-table.tsx`
- **Modify:** `src/components/ui/table/data-table.alignment.test.tsx`
- **Modify:** `src/components/ui/table/data-table-body.tsx`
- **Modify:** `src/components/ui/table/data-table-actions-column.test.tsx`
- **Modify:** `src/components/ui/table/data-table-row-action.tsx`
- **Modify:** `src/features/users/components/users-table/columns.tsx`
- **Modify:** `src/features/users/components/users-table/index.tsx`
- **Modify:** `src/components/ui/table/data-table.test.tsx`
- **Modify:** `src/hooks/use-data-table.internal-state.test.tsx`
- **Reference:** `docs/superpowers/specs/2026-06-01-data-table-row-expand-design.md`

---

### Task 0: 浏览器环境预检与 smoke 骨架

**Type:** `infra`

**Files**

- Create: `e2e/data-table-row-expand.smoke.spec.ts`

**Shared Runtime Contracts**

- `none`

**Invariants**

- 该 task 只验证浏览器环境和现有 `/dashboard/users` 页面可达性
- 不在本 task 中实现任何业务级 expand 行为断言

**Constraints**

- 必须在第一个 behavior task 之前完成
- 只允许检查 server startup、路由、关键 selector、基础 click path、SSR/CSR 健康
- 不得把 preflight 当作最终业务回归 smoke
- 新增 Playwright 用例禁止使用无理由的 `waitForTimeout`；必须优先等待稳定 selector 或显式业务条件

**Acceptance Criteria**

- [ ] `profile: task-0-browser-preflight` 通过
- [ ] Playwright 能稳定启动并命中 `/dashboard/users`
- [ ] preflight 测试文件可被后续任务扩展为最终 smoke
- [ ] preflight 已约定后续真实 smoke 依赖稳定 `data-slot` / selector 契约，而不是脆弱文本选择器

**Verification Profile**

- `profile: task-0-browser-preflight`
  - `pnpm run test:e2e:smoke -- e2e/data-table-row-expand.smoke.spec.ts --grep @preflight`
- `Expected Signals:` 预检用例通过，失败时能定位为环境 / 路由 / selector 问题，而不是业务功能问题

**Verification Strategy**

- `build + smoke`

**Browser Gate Role**

- `preflight`

- [ ] Step 1: 新建 `e2e/data-table-row-expand.smoke.spec.ts`，仅写 `@preflight @workspace-v2` 用例，并确认后续真实业务 smoke 也沿用 `@workspace-v2` 标签
- [ ] Step 2: 预检 `/dashboard/users` 可启动、用户表格主体可见、关键 selector 稳定
- [ ] Step 3: Run `profile: task-0-browser-preflight`
- [ ] Step 4: Commit `test: add data-table row expand browser preflight`

---

### Task 1: 稳定 rowKey 契约与 hook 展开态

**Type:** `behavior`

**Files**

- Modify: `src/types/data-table.ts`
- Modify: `src/hooks/use-data-table.ts`
- Modify: `src/hooks/use-data-table.internal-state.test.tsx`

**Shared Runtime Contracts**

- `DataTable` 展开态不再依赖 TanStack `row.id`

**Invariants**

- 未传 `expandConfig` 时，现有 hook state 行为不变
- pagination / sorting / filters / rowSelection 现有语义不变
- `expandedRowKey` 只跟踪当前页数据，不跨页保活

**Constraints**

- 不引入新的第三方依赖
- 不要求消费方必须配置 `getRowId`
- `rowKey` 只能指向 `string | number` 字段

**Acceptance Criteria**

- [ ] `profile: task-1-expand-contract` 通过
- [ ] `expandedRowKey` 在当前页数据缺失时自动关闭
- [ ] 类型层保留 `defineExpandConfig()` 的字面量约束，组件消费侧使用宽类型边界

**Verification Profile**

- `profile: task-1-expand-contract`
  - `pnpm exec vitest run src/hooks/use-data-table.internal-state.test.tsx`
  - `pnpm exec tsc --noEmit`
- `Expected Signals:` hook 测试全绿，TypeScript 无新增错误

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: 先在 `src/hooks/use-data-table.internal-state.test.tsx` 增加 `expandedRowKey`、`rowKey`、自动关闭行为用例
- [ ] Step 2: 在 `src/types/data-table.ts` 引入 `ExpandConfig` / `ExpandConfigEdge` / `ExpandRowKeyField`
- [ ] Step 3: 在 `src/hooks/use-data-table.ts` 实现 `expandedRowKey`、`expandedRow` 和自动关闭逻辑
- [ ] Step 4: Run `profile: task-1-expand-contract`
- [ ] Step 5: Commit `feat: add row-key based data-table expand state`

---

### Task 2: 行点击边界与可访问 disclosure 入口

**Type:** `behavior`

**Files**

- Create: `src/components/ui/table/data-table-expand-trigger.tsx`
- Modify: `src/hooks/use-data-table.ts`
- Modify: `src/components/ui/table/data-table-body.tsx`
- Modify: `src/components/ui/table/data-table-actions-column.test.tsx`
- Modify: `src/components/ui/table/data-table-row-action.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**

- row expand 点击边界
- row selection 与 row action 的事件冒泡边界
- pointer row click 与 keyboard / screen reader disclosure button 的一致性
- expand trigger 列与 utility pinning 顺序

**Invariants**

- 点击普通 cell 文本、图片、badge 时仍可展开
- 点击 action / dropdown / checkbox 时不得展开
- keyboard / screen reader 必须有正式入口，但不能把普通 table row 改造成伪 treegrid 行
- virtual / non-virtual 两个 row 渲染分支都必须走同一套点击判定

**Constraints**

- 禁止用 `e.target !== e.currentTarget` 作为唯一兜底
- `DataTableRowActions` 必须在共享组件层阻断冒泡
- 不允许在普通 `table row` 上写 `aria-expanded`
- expand enabled 时必须自动生成 disclosure button 列，button 承载 `aria-expanded` / `aria-controls`
- generated expand trigger column id 固定为 `__rowExpand`
- expand trigger 列必须加入左侧 utility pinning group，并保持 `row number -> select -> expand trigger -> actions(仅当 actionColumnPin='left') -> user-defined left columns` 的顺序
- 若存在 `initialState.columnOrder`，必须同步归一化 `__rowExpand` 的 columnOrder 位置，不能依赖缺失 id 的默认追加行为
- disclosure button 的 `aria-controls` 必须遵循稳定 panel id 契约：`data-table-expand-panel-{tableId || instanceId}`
- `instanceId` 必须基于 `React.useId()` 等 SSR / hydration 稳定来源
- expand trigger / panel / close / split handle 必须暴露稳定 `data-slot` hook，供 RTL 与 Playwright 使用

**Acceptance Criteria**

- [ ] `profile: task-2-click-boundary` 通过
- [ ] 行点击只在非交互内容区域触发
- [ ] action、dropdown、checkbox 不会双触发
- [ ] disclosure button 可通过键盘展开 / 收起并暴露正确无障碍语义
- [ ] expand trigger 列的 pinning 顺序在左右 pin 场景下都符合 spec
- [ ] virtualized 与 non-virtualized 两个 row 分支都通过相同点击边界回归
- [ ] 存在 `initialState.columnOrder` 时，`__rowExpand` 仍位于 `select` 之后而非被默认追加到尾部

**Verification Profile**

- `profile: task-2-click-boundary`
  - `pnpm exec vitest run src/components/ui/table/data-table.test.tsx`
  - `pnpm exec vitest run src/components/ui/table/data-table-actions-column.test.tsx`
- `Expected Signals:` 新增点击边界、disclosure button、pinning 顺序测试通过，现有 DataTable 回归测试无失败

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: 先在 `src/components/ui/table/data-table.test.tsx` 与 `src/components/ui/table/data-table-actions-column.test.tsx` 写出“点击普通文本展开 / 点击 action 不展开 / disclosure button 键盘触发 / `__rowExpand` pinning 顺序 / `initialState.columnOrder` 归一化 / virtualized 分支点击边界”的回归用例
- [ ] Step 2: 新建 `data-table-expand-trigger.tsx`，实现 disclosure button 的 `aria-expanded` / `aria-controls` / `stopPropagation()`，并暴露稳定 `data-slot`
- [ ] Step 3: 在 `use-data-table.ts` 自动生成 `__rowExpand` 列，并更新 utility pinning 顺序、`initialState.columnOrder` 归一化与 panel id 契约
- [ ] Step 4: 在 `data-table-body.tsx` 实现 selector-based row click guard
- [ ] Step 5: 在 `data-table-row-action.tsx` 增加 `stopPropagation()` 与 `data-row-expand-ignore`
- [ ] Step 6: Run `profile: task-2-click-boundary`
- [ ] Step 7: Commit `feat: add accessible disclosure trigger for data-table row expand`

---

### Task 3: 像素精确 split 计算工具

**Type:** `behavior`

**Files**

- Create: `src/lib/data-table-expand-split.ts`
- Create: `src/lib/data-table-expand-split.test.ts`

**Shared Runtime Contracts**

- expanded 布局的高度约束与回退策略

**Invariants**

- 正常容器下必须精确满足 `top >= 200`、`bottom >= 150`、`handle = 8`
- 拖拽结果必须被 clamp 到合法区间
- 窗口或容器 resize 后，当前 top 高度必须重新 clamp 到新合法区间，而不是重置默认值
- `hostHeight < 358` 时必须显式进入锁定回退态

**Constraints**

- 纯函数工具不可依赖 DOM
- 禁止把像素最小高度转换成固定百分比常量
- 初始高度、拖拽 clamp、极小容器回退都要在单测覆盖
- resize 导致的 hostHeight 收缩 / 扩张后 re-clamp 也要在单测覆盖

**Acceptance Criteria**

- [ ] `profile: task-3-split-math` 通过
- [ ] 工具输出可以驱动 expanded 布局，无需在组件内重复写魔法数字
- [ ] resize 导致的高度越界会被 clamp，而不是静默重置默认值

**Verification Profile**

- `profile: task-3-split-math`
  - `pnpm exec vitest run src/lib/data-table-expand-split.test.ts`
- `Expected Signals:` clamp、初始值、回退态相关用例全部通过

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: 先为初始高度、拖拽 clamp、resize re-clamp、极小容器回退写单测
- [ ] Step 2: 实现 `resolveExpandSplitLayout()` / `clampExpandSplitTop()` 一类纯函数
- [ ] Step 3: Run `profile: task-3-split-math`
- [ ] Step 4: Commit `feat: add pixel-accurate data-table expand split math`

---

### Task 4: Expanded 布局与底部 Tabs 面板

**Type:** `behavior`

**Files**

- Create: `src/components/ui/table/data-table-expand-panel.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/components/ui/table/data-table.alignment.test.tsx`
- Modify: `src/components/ui/table/data-table-body.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**

- `DataTable` 收起态 / 展开态布局切换
- 列宽 overlay root 与 expanded 布局共存
- virtual / non-virtual row 渲染分支共享展开高亮逻辑

**Invariants**

- 未启用 `expandConfig` 时，`data-table.tsx` 的现有布局与 DOM 结构保持不变
- `DataTableExpandPanel` 只负责 tabs 与内容，不持有当前行状态
- 切换行时 active tab 保持或按规则回退
- splitter 高度在同一 `DataTable` mount 生命周期内保持，路由卸载后重置
- 窗口或容器 resize 后，当前 splitter 高度按 Task 3 的纯函数规则被重新 clamp

**Constraints**

- 收起模式下不得引入任何 splitter DOM
- expanded 模式下不得复用 `react-resizable-panels` 作为主实现
- `DataTable` 必须继续兼容 virtualization、sticky header、列宽 overlay
- custom splitter handle 必须支持 `role="separator"` 与 ArrowUp/ArrowDown/Home/End 键盘调整
- expanded 布局新增节点不得破坏现有 colgroup / pinning / measured-header 对齐体系

**Acceptance Criteria**

- [ ] `profile: task-4-expand-layout` 通过
- [ ] 展开后可以渲染底部 tabs 面板并关闭
- [ ] 相同行重复点击不重置 splitter 高度
- [ ] 切换行时 active tab 按 spec 规则保留或回退
- [ ] 关闭后重开保持 splitter 高度，路由重挂载后恢复默认高度
- [ ] 窗口 / 容器 resize 后 splitter 高度 clamp 到合法区间，不回退默认值
- [ ] splitter handle 的键盘调整路径可用
- [ ] 收起模式现有测试零回归
- [ ] expand enabled 后 colgroup / pinning / measured-header 对齐回归仍然成立

**Verification Profile**

- `profile: task-4-expand-layout`
  - `pnpm exec vitest run src/components/ui/table/data-table.test.tsx`
  - `pnpm exec vitest run src/components/ui/table/data-table.alignment.test.tsx`
  - `pnpm exec vitest run src/hooks/use-data-table.internal-state.test.tsx`
  - `pnpm exec vitest run src/lib/data-table-expand-split.test.ts`
- `Expected Signals:` expanded 场景新测试通过，alignment / split math 回归无失败，现有 DataTable 测试无回归

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: 先在 `data-table.test.tsx` 与 `data-table.alignment.test.tsx` 为 expand panel、tab fallback、close、splitter DOM、splitter 键盘调节、关闭后重开高度保持、resize clamp、expand-enabled 对齐回归写失败用例
- [ ] Step 2: 新建 `data-table-expand-panel.tsx`
- [ ] Step 3: 在 `data-table.tsx` 接入 splitter math、expanded 布局、panel 渲染和 active tab 状态，并保持 colgroup / header measurement 路径不漂移
- [ ] Step 4: 在 `data-table-body.tsx` 接入 `getExpandRowKey` 与 expanded 高亮
- [ ] Step 5: Run `profile: task-4-expand-layout`
- [ ] Step 6: Commit `feat: add expandable detail panel to data-table`

---

### Task 5: Users 首个消费方落地

**Type:** `wiring`

**Files**

- Create: `src/features/users/components/users-table/expand-config.tsx`
- Modify: `src/features/users/components/users-table/columns.tsx`
- Modify: `src/features/users/components/users-table/index.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**

- 通用 DataTable expand 能力在真实 consumer 上的接线方式

**Invariants**

- `users` 页面是首个真实消费方，`products` 页面在本任务中不接入
- expand tabs 首版只依赖当前 row 数据，不引入新的服务端请求
- `users` 页面原有 row selection、row actions、Sheet action 行为继续保留
- `users-table/columns.tsx` 中的 select wrapper 修复属于已知消费方漏洞修复，在本 task 内随 first adopter 一并落地，而不是共享 DataTable contract 的一部分

**Constraints**

- 不在本 task 中顺带接入其他表格页
- tabs 内容必须稳定、可回归、无额外异步依赖
- `users-table/columns.tsx` 的修复必须保持局部，不得顺带重写其他列定义模式

**Acceptance Criteria**

- [ ] `profile: task-5-first-adopter` 通过
- [ ] `/dashboard/users` 成功启用 expandConfig
- [ ] users 页的 checkbox、action、Sheet 与 detail panel 不互相干扰
- [ ] `users-table/columns.tsx` 的 select wrapper 已显式 `stopPropagation()` 并标记 `data-row-expand-ignore`

**Verification Profile**

- `profile: task-5-first-adopter`
  - `pnpm exec vitest run src/components/ui/table/data-table.test.tsx`
  - `pnpm exec tsc --noEmit`
- `Expected Signals:` users 接线后类型正确，组件测试无回归

**Verification Strategy**

- `integration smoke`

**Browser Gate Role**

- `none`

- [ ] Step 1: 新建 `src/features/users/components/users-table/expand-config.tsx`，定义 users tabs 配置
- [ ] Step 2: 在 `users-table/columns.tsx` 修复 select wrapper 的 `stopPropagation()` 与 `data-row-expand-ignore`
- [ ] Step 3: 在 `users-table/index.tsx` 接入 `expandConfig`
- [ ] Step 4: 补充 users 真实消费方接线的测试断言
- [ ] Step 5: Run `profile: task-5-first-adopter`
- [ ] Step 6: Commit `feat: adopt data-table row expand on users page`

---

### Task 6: 跨任务回归审计与最终验收

**Type:** `refactor`

**Files**

- Modify: `e2e/data-table-row-expand.smoke.spec.ts`
- Modify: `src/components/ui/table/data-table.test.tsx`
- Modify: `src/hooks/use-data-table.internal-state.test.tsx`
- Modify: `docs/superpowers/specs/2026-06-01-data-table-row-expand-design.md` (仅在实现暴露 spec 歧义时回写澄清；不改设计结论)

**Shared Runtime Contracts**

- row click / row selection / row actions
- expanded / collapsed layout dual mode
- disclosure button 与 pointer row click 双轨入口
- virtualization / sticky header / resize overlay 共存

**Invariants**

- 收起模式必须零视觉语义回归
- 未启用 `expandConfig` 的 consumer 不需要任何代码改动
- 所有新增测试必须描述业务语义，不测试实现细节

**Constraints**

- 若实现暴露 spec 歧义，只允许补澄清，不允许改写设计结论
- 不在本 task 内引入新的产品行为
- `e2e/data-table-row-expand.smoke.spec.ts` 中所有真实业务 smoke 用例必须带 `@workspace-v2` 标签，确保被默认 Playwright project 收集
- 只有当实现者无法从现有 spec 推导出单一行为路径，且该差异会改变 acceptance semantics 时，才视为“spec 歧义”允许回写
- 新增 Playwright smoke 继续禁止无理由 `waitForTimeout`，必须优先等待稳定 `data-slot` / DOM condition / route condition

**Acceptance Criteria**

- [ ] `profile: task-6-final-regression` 通过
- [ ] 所有共享运行时约束均有回归覆盖
- [ ] Playwright smoke 覆盖 users 首个消费方真实交互
- [ ] build / lint / types 全部通过
- [ ] browser smoke 仅依赖稳定 selector / condition，不依赖脆弱文本或拍脑袋超时

**Verification Profile**

- `profile: task-6-final-regression`
  - `pnpm run test:e2e:smoke -- e2e/data-table-row-expand.smoke.spec.ts`
  - `pnpm exec vitest run src/components/ui/table/data-table.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/lib/data-table-expand-split.test.ts`
  - `pnpm test:unit`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm exec tsc --noEmit`
- `Expected Signals:` Playwright smoke 和全部命令退出码均为 0；无新的 DataTable 相关失败

**Verification Strategy**

- `regression guard`

**Browser Gate Role**

- `rollout`

- [ ] Step 1: 把 `e2e/data-table-row-expand.smoke.spec.ts` 从 `@preflight` 扩展为真实业务 smoke，并确保所有业务用例带 `@workspace-v2` 标签
- [ ] Step 2: 使用稳定 `data-slot` / DOM condition 扩展 smoke，覆盖 users 页的 disclosure button、row click、关闭、切行、checkbox 不展开、action 不展开、drag resize
- [ ] Step 3: 汇总补齐所有共享运行时约束的测试空洞
- [ ] Step 4: Run `profile: task-6-final-regression`
- [ ] Step 5: 若实现暴露 spec 歧义，仅回写 spec 澄清语句
- [ ] Step 6: Commit `test: finalize data-table row expand regression coverage`

---

## Execution Handoff

Saved plan path:

- `docs/plans/2026-06-01-data-table-row-expand.md`

Recommended execution mode:

- `executing-plans`

原因：

- 这是一个单 session、线性推进即可完成的单文件计划
- 任务之间依赖清晰，但不需要 folder plan 级别的多角色 runtime 状态
- 真正的风险在共享运行时约束，已经通过 Task 6 的最终验收显式收口
