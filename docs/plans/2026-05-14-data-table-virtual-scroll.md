# DataTable 虚拟滚动实施计划

> **给 Claude 的提示：** 使用 `executing-plans` skill 按任务顺序逐一实施本计划；每完成一个 task，先执行该 task 的验证命令，再继续下游 task。

**目标：** 为共享 `DataTable` 增加可选的行虚拟滚动能力，优先解决产品列表在 `perPage=500/2000` 下的 DOM 渲染成本，同时保持当前分页、筛选、排序、workspace tabs 与 rollback 路径的行为不变。

**架构：** 虚拟滚动严格限定在 `src/components/ui/table/data-table*.tsx` 渲染层内实现。`useDataTable` 继续只负责 TanStack Table 状态和当前 internal-state / deprecated search-adapter 双模式；产品页、用户页继续各自把表状态同步到自己的 API 查询参数。首版采用“固定行高 + spacer row”的 `<tbody>` 方案，避免把现有 `<table>` 重写为 `grid/flex` 布局；若 Task 3 的浏览器校准确认当前行高并不稳定，则立即停止该 task 并回写 replan，不允许带病落地半工作的 fixed-height 方案。

**技术栈：** React 19、TypeScript、TanStack Table v8、`@tanstack/react-virtual`、Radix Scroll Area、Vitest、Playwright

---

## 工作流对齐

- 本计划使用当前仓库已经采用的单文件 execution-ready 格式，不再保留旧版“高层思路 + 手工发挥”的写法。
- 最终验收包含 Playwright 浏览器回归，因此 Task 1 必须先做 preflight，确认现有产品列表 smoke 路径和稳定 selector 可用。
- Task 2 和 Task 3 共同触达同一个共享运行时契约：`DataTable` 的 viewport 身份、`scrollTargetId` 绑定以及 body 渲染分层。Task 4 作为跨任务回归 gate，必须在宣布完成前跑通。
- 执行时若发现产品列表当前行高在同一页内明显不恒定，或 pinned column / sticky header 与 spacer row 方案存在结构性冲突，立即暂停 Task 3，保留已通过验证的 Task 1-2 结果，并把后续改写为新的 `measureElement` 版 plan；不要在本计划内继续扩 scope。

## 前提修正

- 仓库当前已经配置 `vitest.config.ts`、`src/test/setup.ts`、`playwright.config.ts`，并存在 `pnpm test:unit` 与 `pnpm test:e2e:smoke` 脚本；旧版“没有 test runner，只能 lint + build + manual QA”的前提已失效。
- `src/hooks/use-data-table.ts` 当前默认是 internal-state 模式；`searchAdapter` 只是带 `@deprecated` 注释的兼容路径。虚拟滚动计划不能再以“search params 是主路径”来描述职责边界。
- `src/components/ui/table/data-table.tsx` 当前负责 header、body、footer、action bar、`scrollTargetId -> data-scroll-target-id` 透传；`src/components/ui/scroll-area.tsx` 已支持 `viewportProps`，但还没有给调用方安全暴露 viewport ref。
- `src/features/products/components/product-tables/index.tsx` 当前通过 `useDataTablePageSize()` 从 `localStorage` 读写页大小偏好，mock 数据总量是 `2000` 行，且页大小选项是 `[10, 50, 100, 500, 2000]`；这是首个 rollout 目标。
- `src/features/users/components/users-table/index.tsx` 当前总量是 `50` 行，不应在首版强行开启虚拟滚动，但它是共享 `DataTable` 回归目标，必须确认非 opt-in 路径不被破坏。
- 当前产品/用户页都在 feature 层把 `table.getState()` 映射回 API filters，再通过 React Query 拉当前页数据。虚拟滚动只能优化“当前页 DOM 渲染”，不能改动 server pagination、query key 或 hook 状态所有权。

## 文件结构

- Create: `src/components/ui/table/data-table.test.tsx`
- Create: `src/components/ui/table/data-table-body.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/components/ui/scroll-area.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/products/components/product-tables/index.tsx`
- Modify: `e2e/workspace-tabs-smoke.spec.ts`
- Test: `src/components/ui/table/data-table.test.tsx`
- Test: `src/hooks/use-data-table.internal-state.test.tsx`
- Test: `src/hooks/use-data-table.search-adapter.test.tsx`
- Test: `src/features/products/components/product-tables.internal-state.test.tsx`
- Test: `src/features/users/components/users-table.internal-state.test.tsx`
- Reference: `README.md`
- Reference: `src/hooks/use-data-table.ts`
- Reference: `src/lib/data-table-page-size.ts`
- Reference: `src/constants/mock-api.ts`
- Reference: `src/constants/mock-api-users.ts`
- Reference: `vitest.config.ts`
- Reference: `playwright.config.ts`

---

### Task 1: 建立 DataTable 基线测试与浏览器预检

**Type:** `infra`

**Files**
- Create: `src/components/ui/table/data-table.test.tsx`
- Modify: `e2e/workspace-tabs-smoke.spec.ts`

**Shared Runtime Contracts**
- `DataTable` 的 viewport 身份必须继续通过 `scrollTargetId -> data-scroll-target-id` 暴露给浏览器层
- 当前 `<table><thead/><tbody/></table>` DOM 结构必须在测试里被显式固定下来

**Invariants**
- rollback 项目下 `Workspace tabs` 仍然不存在
- 当前非虚拟化渲染路径必须继续一次性渲染所有 body rows
- 空数据时 `emptyMessage` 仍然渲染在单个 `colSpan={table.getAllColumns().length}` 的占位行里

**Constraints**
- 本 task 不引入 `@tanstack/react-virtual`
- 本 task 不允许修改 `useDataTable`
- 若现有生产代码已经能暴露所需 selector，不要为了测试额外添加无业务价值的属性

**Acceptance Criteria**
- [ ] `profile: task-1-preflight` 通过
- [ ] `src/components/ui/table/data-table.test.tsx` 能用真实 `useReactTable()` harness 覆盖当前 empty / non-empty / `scrollTargetId` 行为
- [ ] `e2e/workspace-tabs-smoke.spec.ts` 新增一个 rollback smoke，显式证明产品表 viewport selector 稳定可寻址

**Verification Profile**
- `profile: task-1-preflight`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx`
  - `pnpm run build`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=rollback --grep "product listing exposes stable scroll viewport selector"`
- `Expected Signals:` Vitest 全绿；Playwright 能看到 `[data-scroll-target-id="products-table"]`、至少一行可见产品数据、且 rollback 项目没有 `Workspace tabs`

**Verification Strategy**
- `build + smoke`

**Browser Gate Role**
- `preflight`

- [ ] Step 1: 在 `src/components/ui/table/data-table.test.tsx` 中建立最小真实 harness，使用 `@tanstack/react-table` 创建 `table`，覆盖以下三件事：正常渲染所有 rows、空态行、`scrollTargetId` 被透传到 viewport。
- [ ] Step 2: 在 `e2e/workspace-tabs-smoke.spec.ts` 新增唯一命名的 rollback smoke：`product listing exposes stable scroll viewport selector`；它只验证环境可启动、产品列表能出首屏数据、viewport selector 存在，不承担业务回归职责。
- [ ] Step 3: 运行 `profile: task-1-preflight`；若 preflight 失败，先修测试基线或 selector，再进入 Task 2。
- [ ] Step 4: Commit `test: add data table viewport preflight coverage`

---

### Task 2: 抽离 DataTable body 并暴露 viewport ref

**Type:** `refactor`

**Files**
- Create: `src/components/ui/table/data-table-body.tsx`
- Modify: `src/components/ui/scroll-area.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**
- `ScrollArea` 的 `viewportProps` 兼容性
- `DataTable` 对 header / footer / action bar 的所有权
- `scrollTargetId` 所在 viewport 节点的稳定性

**Invariants**
- 没有传入 `virtualization` 时，`DataTable` 的渲染结果必须与 Task 1 基线一致
- `TableHeader`、`DataTablePagination`、`actionBar` 条件渲染和 `getCommonPinningStyles()` 使用位置不变
- `useDataTable` 文件在本 task 中保持零改动

**Constraints**
- 本 task 只做分层和 ref 暴露，不得引入虚拟滚动分支
- 不得顺手改 workspace-tabs、query filters、分页文案或页面级 API 同步逻辑
- `ScrollArea` 的新 ref API 必须是 additive，现有 `viewportProps` 调用方式继续可用

**Acceptance Criteria**
- [ ] `profile: task-2-refactor` 通过
- [ ] `data-table.tsx` 只保留容器、header、footer 和 orchestration；body 行循环迁到新文件
- [ ] `ScrollArea` 对 viewport ref 的暴露方式不破坏当前 `viewportProps` 数据属性透传

**Verification Profile**
- `profile: task-2-refactor`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx`
  - `pnpm exec oxlint src/components/ui/scroll-area.tsx src/components/ui/table/data-table.tsx src/components/ui/table/data-table-body.tsx src/components/ui/table/data-table.test.tsx`
  - `pnpm run build`
- `Expected Signals:` 单测仍证明非虚拟化路径渲染全部 rows；构建无类型错误；`ScrollArea` 新增 ref 能与现有 `viewportProps` 共存

**Verification Strategy**
- `regression guard`

**Browser Gate Role**
- `none`

- [ ] Step 1: 在 `src/components/ui/scroll-area.tsx` 增加专用 `viewportRef`（或等价 additive API），要求同时保留现有 `viewportProps` 的 `data-*` 透传能力。
- [ ] Step 2: 新建 `src/components/ui/table/data-table-body.tsx`，先只实现当前普通 body 渲染与空态分支，不引入任何虚拟滚动逻辑。
- [ ] Step 3: 在 `src/components/ui/table/data-table.tsx` 中创建 `scrollViewportRef`，把它传给 `ScrollArea` 和 `DataTableBody`；header、footer、action bar 保持在原文件。
- [ ] Step 4: 更新 `src/components/ui/table/data-table.test.tsx`，确保 ref 抽离后基线行为未变。
- [ ] Step 5: 运行 `profile: task-2-refactor`。
- [ ] Step 6: Commit `refactor: isolate data table body rendering`

---

### Task 3: 实现虚拟滚动核心并在产品表首个接入

**Type:** `behavior`

**Files**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/types/data-table.ts`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/components/ui/table/data-table-body.tsx`
- Modify: `src/features/products/components/product-tables/index.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**
- `DataTable` 对外虚拟滚动配置契约
- viewport scroll reset 行为与 `scrollTargetId` 的共存
- 产品页当前 internal-state + React Query 同步链路

**Invariants**
- `src/hooks/use-data-table.ts` 不得新增任何虚拟滚动状态或 `react-virtual` 依赖
- 用户表 `src/features/users/components/users-table/index.tsx` 不在本 task 启用虚拟滚动
- 产品页原有分页、筛选、排序、行操作、pinning 与空态行为保持不变
- 没有传 `virtualization` 的所有 `DataTable` 调用方继续走 Task 2 的普通 body 路径

**Constraints**
- 仅允许在渲染层新增 `@tanstack/react-virtual`
- 首版只支持固定行高 + spacer row；不要把共享表重写成 CSS grid
- `scroll reset` 只能基于 `pagination` / `sorting` / `columnFilters` / row model 切换做局部处理，不能反向修改 feature 层状态源
- 若浏览器校准发现产品行高在同一页内明显不恒定，立即停止本 task 并回写新的 replan，不要硬调 magic number 掩盖问题

**Acceptance Criteria**
- [ ] `profile: task-3-virtual-core` 通过
- [ ] `DataTable` 新增 opt-in `virtualization` 配置，且默认行为仍然是关闭
- [ ] 产品表在 `rows.length >= rowCountThreshold` 时只渲染可见 rows；低于阈值时仍完整渲染
- [ ] `scrollTargetId="products-table"` 仍落在同一个 viewport 节点上，供 Playwright 与 workspace 场景复用

**Verification Profile**
- `profile: task-3-virtual-core`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx`
  - `pnpm exec oxlint src/types/data-table.ts src/components/ui/table/data-table.tsx src/components/ui/table/data-table-body.tsx src/features/products/components/product-tables/index.tsx`
  - `pnpm run build`
- `Expected Signals:` `data-table.test.tsx` 同时覆盖普通分支和 virtual 分支；hook 回归测试继续全绿；构建通过且没有把 `react-virtual` 泄漏进 `useDataTable`

**Verification Strategy**
- `TDD`

**Browser Gate Role**
- `none`

**Manual Verification Exception**
- `Waiver Reason:` `estimateRowHeight` 是浏览器布局校准值，`jsdom` 无法给出可信高度；自动化单测只负责验证分支选择、spacer row 和 ref/selector 契约
- `Automated Smoke Check:` `pnpm test:unit -- src/components/ui/table/data-table.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx`
- `Manual Verification Steps:` 启动本地应用后打开 `/dashboard/product`，把每页条数切到 `500` 或 `2000`，滚动表 viewport 至中部和底部，确认 header 仍 sticky、右侧 `actions` pinning 未错位、没有出现整屏空白或 rows 重叠；若出现明显 gap/jitter，再在同一 task 内调整 `estimateRowHeight`
- `Expected Results:` 产品表在大页尺寸下滚动连续，回到顶部/切页后不显示空白 viewport，普通小页尺寸仍是完整渲染
- `Follow-up Automation:` `not needed`，原因是浏览器层不 blank 的高风险路径会在 Task 4 Playwright regression 中覆盖

- [ ] Step 1: 执行 `pnpm add @tanstack/react-virtual`，同步更新 `package.json` 与 `pnpm-lock.yaml`。
- [ ] Step 2: 在 `src/types/data-table.ts` 新增共享类型 `DataTableVirtualizationOptions`，至少包含 `enabled`、`estimateRowHeight`、`overscan`、`rowCountThreshold`、`resetScrollOnChange`。
- [ ] Step 3: 先改 `src/components/ui/table/data-table.test.tsx`，写出以下行为测试再实现生产代码：`enabled=false` 不虚拟化、低于阈值不虚拟化、高于阈值时只渲染 virtual items、上下 spacer row 高度正确、`scrollTargetId` 仍保留。
- [ ] Step 4: 在 `src/components/ui/table/data-table-body.tsx` 引入 `useVirtualizer`，实现分支判断：

```ts
const shouldVirtualize =
  virtualization?.enabled === true &&
  rows.length >= (virtualization.rowCountThreshold ?? 100);
```

- [ ] Step 5: virtual 分支继续复用 `flexRender()` 与 `getCommonPinningStyles()`，用 `<tbody>` spacer rows 表示 `paddingTop` / `paddingBottom`；不要改 header 结构。
- [ ] Step 6: 在 `src/components/ui/table/data-table.tsx` 暴露 `virtualization?: DataTableVirtualizationOptions` prop。
- [ ] Step 7: 在 `src/features/products/components/product-tables/index.tsx` 为产品表首个启用虚拟滚动，建议初始配置为 `enabled: true`、`estimateRowHeight: 56`、`overscan: 8`、`rowCountThreshold: 100`、`resetScrollOnChange: true`；用户表不改。
- [ ] Step 8: 运行 `profile: task-3-virtual-core`，再完成上面的手动浏览器校准。
- [ ] Step 9: Commit `feat: add opt-in data table virtualization`

---

### Task 4: 扩展 Playwright 回归并完成跨任务验收

**Type:** `wiring`

**Files**
- Modify: `e2e/workspace-tabs-smoke.spec.ts`

**Shared Runtime Contracts**
- 产品表 viewport selector 稳定性
- workspace tabs 下产品列表的页面状态保留行为
- rollback 项目下无 workspace shell 的产品/用户列表行为

**Invariants**
- 现有 `switching away from a paginated list page and back preserves page state` 不得被虚拟滚动破坏
- rollback 项目下 `user listing works via v2 internal-state without workspace shell` 仍必须通过，证明非 opt-in 共享表没有被误伤
- 本 task 不修改 `useDataTable`、workspace shell 运行时或 feature API filters

**Constraints**
- Playwright 只补与虚拟滚动直接相关的 smoke，不在本计划中顺手重写整份 `workspace-tabs-smoke.spec.ts`
- 所有新 smoke 都必须有唯一、稳定、可单独 `--grep` 的测试名

**Acceptance Criteria**
- [ ] `profile: task-4-regression` 通过
- [ ] default 项目下新增一个 workspace 场景，证明大页尺寸产品表在 tab 切换前后都不会出现 blank viewport
- [ ] rollback 项目下新增一个产品表场景，证明虚拟滚动激活后仍能滚动并保持可见 rows

**Verification Profile**
- `profile: task-4-regression`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx src/features/products/components/product-tables.internal-state.test.tsx src/features/users/components/users-table.internal-state.test.tsx`
  - `pnpm lint`
  - `pnpm run build`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=default --grep "switching away from a paginated list page and back preserves page state|virtualized product list survives tab switches"`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=rollback --grep "product listing exposes stable scroll viewport selector|rollback product list virtualizes large page without blank viewport|user listing works via v2 internal-state without workspace shell"`
- `Expected Signals:` unit tests、lint、build 全绿；default 项目下产品列表切到大页尺寸后切到用户页再切回仍能看到可见 rows；rollback 项目下产品表切到大页尺寸并滚动后不出现空白 viewport，用户页仍可正常渲染

**Verification Strategy**
- `integration smoke`

**Browser Gate Role**
- `regression`

- [ ] Step 1: 在 `e2e/workspace-tabs-smoke.spec.ts` 新增 default 项目测试 `virtualized product list survives tab switches`；步骤必须包含：进入产品页、把每页条数切到至少 `500`、滚动 `[data-scroll-target-id="products-table"]`、切到用户页再切回产品页、确认仍有可见 rows 且分页状态没有重置。
- [ ] Step 2: 在同一 spec 新增 rollback 测试 `rollback product list virtualizes large page without blank viewport`；步骤必须包含：进入产品页、把每页条数切到 `2000`、滚动 viewport、确认中途和滚动后都存在可见 rows，且页面没有 `Something went wrong`。
- [ ] Step 3: 保留并复跑已有 rollback 用户列表 smoke，确保用户表作为非 opt-in 调用方没有被共享层改坏。
- [ ] Step 4: 运行 `profile: task-4-regression`。这是整个计划的跨任务回归 gate，任何失败都必须回到对应 task 修复后重跑。
- [ ] Step 5: Commit `test: cover virtualized data table regressions`

---

## 完成定义

满足以下条件才可以宣布本计划完成：

- `DataTable` 的虚拟滚动是显式 opt-in，默认关闭。
- `useDataTable` 没有引入任何 `react-virtual` 依赖，也没有新增虚拟滚动状态。
- 产品表已启用虚拟滚动并通过大页尺寸 smoke；用户表仍走普通渲染路径且回归通过。
- `scrollTargetId -> data-scroll-target-id` 契约保持不变，Task 1 和 Task 4 的 Playwright 都能稳定命中相同 viewport。
- `pnpm lint`、Task 4 的 unit profile、Task 4 的 Playwright profile、`pnpm run build` 全部通过。

## 执行顺序

1. Task 1
2. Task 2
3. Task 3
4. Task 4

不要跳 task，也不要把 Task 4 提前；它是 Task 2-3 共享运行时契约的总回归 gate。
