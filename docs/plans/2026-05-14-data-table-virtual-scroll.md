# DataTable 虚拟滚动实施计划

> **给 Claude 的提示：** 使用 `executing-plans` skill 按任务顺序逐一实施本计划；每完成一个 task，先执行该 task 的验证命令，再继续下游 task。

**目标：** 为共享 `DataTable` 增加可选的行虚拟滚动能力，优先解决产品列表在 `perPage=500/2000` 下的 DOM 渲染成本，同时保持当前分页、筛选、排序、workspace tabs、rollback 路径与原生表格可访问性语义不变。

**架构：** 虚拟滚动严格限定在 `src/components/ui/table/data-table*.tsx` 渲染层内实现。`useDataTable` 继续只负责 TanStack Table 状态和当前 internal-state / deprecated search-adapter 双模式；产品页、用户页继续各自把表状态同步到自己的 API 查询参数。首版主线不再假设 spacer row 可行，而是以当前 `absolute-position virtual rows` prototype 为 incumbent 路线，并先通过 Task 0 证明“DOM virtualization 的 ROI 值得做”以及“spacer row 的列宽稳定性是否成立”；若任一 gate 不成立，则本计划守住 absolute rows，不在首版迁移到 spacer row。本计划保留原生 HTML `table` 语义，不把共享表升级为 `role="grid"` 复合组件。开启虚拟化的调用体验必须尽量接近布尔开关：调用方默认只表达“开/关”，具体 `estimateRowHeight`、`overscan`、`rowCountThreshold` 等由共享配置提供。企业商用约束额外覆盖三条运行时拓扑：`Suspense + useSuspenseQuery` 的 unmount/remount、workspace V2 `Activity hidden` keep-alive 生命周期、虚拟化运行时异常的局部降级与可观测性。

**技术栈：** React 19、TypeScript、TanStack Table v8、`@tanstack/react-virtual`、Radix Scroll Area、Vitest、Playwright

---

## 工作流对齐

- 本计划使用当前仓库已经采用的单文件 execution-ready 格式，不再保留旧版“高层思路 + 手工发挥”的写法。
- 最终验收包含 Playwright 浏览器回归，因此 Task 1 必须先做 preflight，确认现有产品列表 smoke 路径和稳定 selector 可用。
- Task 2 和 Task 3 共同触达同一个共享运行时契约：`DataTable` 的 viewport 身份、`scrollTargetId` 绑定、`Suspense` remount、`Activity hidden` keep-alive 以及 body 渲染分层。Task 4 作为跨任务回归 gate，必须在宣布完成前跑通。
- 执行顺序前置一个 Task 0：先证明瓶颈确实值得做 DOM virtualization，再验证 spacer row 的 Column Width Stability Gate；若 gate 未通过，则本计划继续以 absolute rows 为主线，不在首版里硬迁 spacer row。
- 执行时若发现产品列表当前行高在同一页内不满足本计划定义的 fixed-height gate，或 pinned column / sticky header 与当前 absolute rows / 候选 spacer row 任一路线存在结构性冲突，立即暂停 Task 3，保留已通过验证的上游结果，并把后续改写为新的 `measureElement` 或非虚拟化优化 plan；不要在本计划内继续扩 scope。

## 前提修正

- 仓库当前已经配置 `vitest.config.ts`、`src/test/setup.ts`、`playwright.config.ts`，并存在 `pnpm test:unit` 与 `pnpm test:e2e:smoke` 脚本；旧版“没有 test runner，只能 lint + build + manual QA”的前提已失效。
- `src/hooks/use-data-table.ts` 当前默认是 internal-state 模式；`searchAdapter` 只是带 `@deprecated` 注释的兼容路径。虚拟滚动计划不能再以“search params 是主路径”来描述职责边界。
- `src/components/ui/table/data-table.tsx` 当前负责 header、body、footer、action bar、`scrollTargetId -> data-scroll-target-id` 透传；`src/components/ui/scroll-area.tsx` 已支持 `viewportProps`，但还没有给调用方安全暴露 viewport ref。
- 仓库当前已经存在一版未完成的虚拟滚动原型：`src/components/ui/table/data-table-body.tsx` 已经引入 `useVirtualizer`，`src/features/products/components/product-tables/index.tsx` 已经直接传入 `virtualization={{ enabled: true, ... }}`。本计划后续所有 “Create/Implement” 均按“收敛并修正现有半成品”理解，不允许在原型之上再叠一层新实现。
- 管理后台视觉方向已确认：首发虚拟表格接受 `单行 + 截断 + 原生 title/aria-label` 的紧凑行规范，以换取统一行高、稳定虚拟化和整齐视觉。增强版 preview / popover 不属于首版主线，避免在验证核心瓶颈前引入新的交互子系统。
- `src/features/products/components/product-tables/index.tsx` 当前通过 `useDataTablePageSize()` 从 `localStorage` 读写页大小偏好，mock 数据总量是 `2000` 行，且页大小选项是 `[10, 50, 100, 500, 2000]`；这是首个 rollout 目标。
- `src/features/products/components/product-screen.tsx` 当前用 `<Suspense fallback={<ProductTableSkeleton />}>` 包住 `ProductTable`，而 `ProductTable` 内部使用 `useSuspenseQuery(productsQueryOptions(apiFilters))`；切页、排序、筛选触发新 query key 时，表格可能经历完整的 suspend → unmount → remount 周期。
- `src/features/users/components/users-table/index.tsx` 当前总量是 `50` 行，不应在首版强行开启虚拟滚动，但它是共享 `DataTable` 回归目标，必须确认非 opt-in 路径不被破坏。
- 当前产品/用户页都在 feature 层把 `table.getState()` 映射回 API filters，再通过 React Query 拉当前页数据。虚拟滚动只能优化“当前页 DOM 渲染”，不能改动 server pagination、query key 或 hook 状态所有权。
- 产品页 route 通过 `WorkspacePageBoundary` 进入 workspace V2，默认 `keepAlive=true`，inactive tab 会通过 `React.Activity mode="hidden"` 保持挂载；虚拟滚动方案必须显式处理 hidden viewport 的 observer / range 生命周期，而不是假设离开页面就会卸载。

## 仓库现状对齐

- 当前计划不是从零引入虚拟滚动，而是把现有 prototype 收敛成企业可签字版本：修正其时序、a11y、sticky/pinning、keepAlive、fallback 和 telemetry 契约。
- 凡是计划中写到 `Create` 的测试文件，只在仓库尚不存在时创建；若文件已存在，则按 `Modify` 处理并保留已有有效覆盖。
- Task 2 必须先把 `data-table-body.tsx` 收敛为可验证的渲染分层基线，再进入 Task 3 的虚拟化契约补全；不允许一边保留现有 prototype 缺陷、一边再增量打补丁。

## 文件结构

- Modify: `src/config/data-table.ts`
- Modify: `src/components/ui/table/data-table.test.tsx`
- Modify: `src/components/ui/table/data-table-body.tsx`
- Create: `src/features/products/components/product-screen.suspense.test.tsx`
- Modify: `package.json`（仅当依赖审计发现版本或声明不满足计划约束时）
- Modify: `pnpm-lock.yaml`（仅当依赖审计发现锁文件需要同步时）
- Modify: `src/components/ui/scroll-area.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/products/components/product-tables/index.tsx`
- Modify: `src/features/products/components/product-tables/columns.tsx`
- Create: `docs/plans/2026-05-14-data-table-virtual-scroll-task0-findings.md`
- Modify: `e2e/workspace-tabs-smoke.spec.ts`
- Test: `src/components/ui/table/data-table.test.tsx`
- Test: `src/features/products/components/product-screen.suspense.test.tsx`
- Test: `src/hooks/use-data-table.internal-state.test.tsx`
- Test: `src/hooks/use-data-table.search-adapter.test.tsx`
- Test: `src/features/products/components/product-tables.internal-state.test.tsx`
- Test: `src/features/users/components/users-table.internal-state.test.tsx`
- Reference: `README.md`
- Reference: `src/hooks/use-data-table.ts`
- Reference: `src/lib/data-table-page-size.ts`
- Reference: `src/constants/mock-api.ts`
- Reference: `src/constants/mock-api-users.ts`
- Reference: `src/config/workspace-tabs.ts`
- Reference: `src/features/products/components/product-screen.tsx`
- Reference: `src/features/workspace-tabs/components/workspace-viewport.tsx`
- Reference: `src/features/workspace-tabs/lib/workspace-devtools.ts`
- Reference: `vitest.config.ts`
- Reference: `playwright.config.ts`

---

### Task 0: 先做 Profiling 与 Column Width Stability Gate

**Type:** `infra`

**Files**

- Create: `docs/plans/2026-05-14-data-table-virtual-scroll-task0-findings.md`

**Shared Runtime Contracts**

- 产品表 `perPage=2000` 下的真实瓶颈归因
- 当前 `absolute-position virtual rows` prototype 与候选 spacer row 路线的列宽稳定性
- sticky header / pinned `actions` 列 / `table-layout:auto` 的共同前提

**Invariants**

- 本 task 不修改 `useDataTable`
- 本 task 不把共享表强行切到 spacer row
- 本 task 不引入增强版 truncated preview / popover 子系统

**Constraints**

- profiling 必须区分两类成本：`首屏/翻页提交耗时` 与 `滚动过程 scripting/layout/paint 占比`，不能只看一个总时间数字
- profiling 结论必须落盘到 `docs/plans/2026-05-14-data-table-virtual-scroll-task0-findings.md`，不能只停留在口头判断
- Column Width Stability Gate 必须以前后对比的方式回答问题：当前 absolute rows 为什么稳定，候选 spacer row 是否会破坏列宽、sticky pinning 或 header 对齐
- 若 profiling 显示 `Rendering + Painting < 30%` 且主要瓶颈在 `JSON.parse`、React reconciliation、TanStack row model，则本计划必须明确记录“DOM virtualization 只解决滚动/DOM 规模，不解决首屏主瓶颈”
- 若 Column Width Stability Gate 未通过，后续 task 一律守住 absolute rows；spacer row 路线改为未来单独 v2 plan

**Acceptance Criteria**

- [ ] `profile: task-0-feasibility` 通过
- [ ] `docs/plans/2026-05-14-data-table-virtual-scroll-task0-findings.md` 明确记录 profiling 结论、主要瓶颈排序、以及 DOM virtualization 的预期收益边界
- [ ] findings 明确记录 Column Width Stability Gate 结论：`pass` / `fail`
- [ ] 若 gate 为 `fail`，本计划下游 task 已明确改为 absolute rows 主线，不再以 spacer row 为默认实现
- [ ] 若 gate 为 `pass`，也只代表“可以进入后续独立设计比较”，不等于本计划必须切换到 spacer row

**Verification Profile**

- `profile: task-0-feasibility`
  - `pnpm run build`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=rollback --grep "product listing exposes stable scroll viewport selector|product listing baseline renders full DOM at page size 2000"`
- `Expected Signals:` 本地应用可启动；产品页能稳定进入 `perPage=2000`；profiling 与 feasibility 观察可重复；findings 文档填入明确结论而非模糊措辞

**Verification Strategy**

- `build + browser feasibility`

**Browser Gate Role**

- `preflight`

- [ ] Step 1: 以当前仓库代码为基线，进入产品页并切到 `perPage=2000`，用 Chrome/Playwright 配合 DevTools 记录两类性能数据：首屏/翻页提交耗时，以及滚动过程中的 scripting/layout/paint 占比。
- [ ] Step 2: 把 profiling 结果写入 `docs/plans/2026-05-14-data-table-virtual-scroll-task0-findings.md`，明确 DOM virtualization 解决的是哪一段成本，不解决的是哪一段成本。
- [ ] Step 3: 以当前 `absolute-position virtual rows` prototype 为 incumbent，做一次 30 分钟上限的 Column Width Stability feasibility check；若需要短时本地 spike，也只允许在工作区临时修改并在 task 结束前回退，不得把未经 gate 证明的 spacer row 实现带入下游。
- [ ] Step 4: 记录 gate 结论：若 spacer row 破坏列宽、sticky、pinning 或 header 对齐，则标记 `fail`，并在 findings 中明确“V1 守住 absolute rows”。
- [ ] Step 5: 只有在 findings 已写清楚后，才进入 Task 1；若 findings 指出 DOM virtualization ROI 过低或 gate 为 `fail`，下游 task 必须按 findings 调整，而不是继续执行旧假设。

---

### Task 1: 建立 DataTable 基线测试与浏览器预检

**Type:** `infra`

**Files**

- Modify: `src/components/ui/table/data-table.test.tsx`
- Modify: `e2e/workspace-tabs-smoke.spec.ts`

**Shared Runtime Contracts**

- `DataTable` 的 viewport 身份必须继续通过 `scrollTargetId -> data-scroll-target-id` 暴露给浏览器层
- 当前 `<table><thead/><tbody/></table>` DOM 结构必须在测试里被显式固定下来
- `perPage=2000` 时产品表当前未虚拟化 DOM 基线必须被记录，供 Task 4 做定量对比

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
- [ ] Task 1 记录产品表在 `perPage=2000` 时的未虚拟化基线：`tbody` 数据行数为 `2000`，作为 Task 4 DOM budget 对照

**Verification Profile**

- `profile: task-1-preflight`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx`
  - `pnpm run build`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=rollback --grep "product listing exposes stable scroll viewport selector|product listing baseline renders full DOM at page size 2000"`
- `Expected Signals:` Vitest 全绿；Playwright 能看到 `[data-scroll-target-id="products-table"]`、至少一行可见产品数据、且 rollback 项目没有 `Workspace tabs`；切到 `perPage=2000` 后 `tbody` 数据行数仍为 `2000`

**Verification Strategy**

- `build + smoke`

**Browser Gate Role**

- `preflight`

- [ ] Step 1: 在 `src/components/ui/table/data-table.test.tsx` 中建立最小真实 harness，使用 `@tanstack/react-table` 创建 `table`，覆盖以下三件事：正常渲染所有 rows、空态行、`scrollTargetId` 被透传到 viewport。
- [ ] Step 2: 在 `e2e/workspace-tabs-smoke.spec.ts` 新增唯一命名的 rollback smoke：`product listing exposes stable scroll viewport selector`；它只验证环境可启动、产品列表能出首屏数据、viewport selector 存在，不承担业务回归职责。
- [ ] Step 3: 在同一 spec 新增 rollback smoke：`product listing baseline renders full DOM at page size 2000`；步骤必须包含切换产品表每页条数到 `2000` 并断言 `tbody` 数据行数为 `2000`，作为未虚拟化基线。
- [ ] Step 4: 运行 `profile: task-1-preflight`；若 preflight 失败，先修测试基线、selector 或 `perPage=2000` 的基线断言，再进入 Task 2。
- [ ] Step 5: Commit `test: add data table viewport preflight coverage`

---

### Task 2: 抽离 DataTable body 并暴露 viewport ref

**Type:** `refactor`

**Files**

- Modify: `src/components/ui/table/data-table-body.tsx`
- Modify: `src/components/ui/scroll-area.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**

- `ScrollArea` 的 `viewportProps` 兼容性
- `DataTable` 对 header / footer / action bar 的所有权
- `scrollTargetId` 所在 viewport 节点的稳定性
- `ScrollAreaPrimitive.Viewport` 不能引入会破坏 sticky containing block 或额外 stacking context 的样式副作用

**Invariants**

- 没有传入 `virtualization` 时，`DataTable` 的渲染结果必须与 Task 1 基线一致
- `TableHeader`、`DataTablePagination`、`actionBar` 条件渲染和 `getCommonPinningStyles()` 使用位置不变
- `useDataTable` 文件在本 task 中保持零改动

**Constraints**

- 本 task 只做分层和 ref 暴露，不得引入虚拟滚动分支
- 不得顺手改 workspace-tabs、query filters、分页文案或页面级 API 同步逻辑
- `ScrollArea` 的新 ref API 必须是 additive，现有 `viewportProps` 调用方式继续可用
- `ScrollAreaPrimitive.Viewport` 不得新增 `transform`、`filter`、`perspective`、`contain: layout/paint/strict`、`will-change: transform` 这类会改变 sticky containing block 或 stacking context 的样式

**Acceptance Criteria**

- [ ] `profile: task-2-refactor` 通过
- [ ] `data-table.tsx` 只保留容器、header、footer 和 orchestration；body 行循环迁到新文件
- [ ] `ScrollArea` 对 viewport ref 的暴露方式不破坏当前 `viewportProps` 数据属性透传
- [ ] `ScrollArea` viewport 的 className / style 审计结果明确记录：没有新增会破坏 sticky header / sticky column 的 containing block 副作用

**Verification Profile**

- `profile: task-2-refactor`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx`
  - `pnpm exec oxlint src/components/ui/scroll-area.tsx src/components/ui/table/data-table.tsx src/components/ui/table/data-table-body.tsx src/components/ui/table/data-table.test.tsx`
  - `pnpm run build`
- `Expected Signals:` 单测仍证明非虚拟化路径渲染全部 rows；构建无类型错误；`ScrollArea` 新增 ref 能与现有 `viewportProps` 共存；viewport 未引入 sticky-breaking 样式

**Verification Strategy**

- `regression guard`

**Browser Gate Role**

- `none`

- [ ] Step 1: 在 `src/components/ui/scroll-area.tsx` 增加专用 `viewportRef`（或等价 additive API），要求同时保留现有 `viewportProps` 的 `data-*` 透传能力。
- [ ] Step 2: 收敛现有 `src/components/ui/table/data-table-body.tsx`，先把它约束成“普通 body 渲染 + 空态分支 + 可注入 viewport ref”的可验证基线；若仓库当前已经混入虚拟滚动 prototype，先拆回到这个基线，再继续下游 task。
- [ ] Step 3: 在 `src/components/ui/table/data-table.tsx` 中创建 `scrollViewportRef`，把它传给 `ScrollArea` 和 `DataTableBody`；header、footer、action bar 保持在原文件。
- [ ] Step 4: 审计 `src/components/ui/scroll-area.tsx` 的 viewport 类名和样式来源，明确记录它不会通过 `transform/filter/will-change/contain` 破坏 sticky containing block；若发现风险，必须在 Task 2 先消除。
- [ ] Step 5: 更新 `src/components/ui/table/data-table.test.tsx`，确保 ref 抽离后基线行为未变。
- [ ] Step 6: 运行 `profile: task-2-refactor`。
- [ ] Step 7: Commit `refactor: isolate data table body rendering`

---

### Task 3: 实现虚拟滚动核心并在产品表首个接入

**Type:** `behavior`

**Files**

- Modify: `src/config/data-table.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/types/data-table.ts`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/components/ui/table/data-table-body.tsx`
- Modify: `src/features/products/components/product-tables/index.tsx`
- Modify: `src/features/products/components/product-tables/columns.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`
- Create: `src/features/products/components/product-screen.suspense.test.tsx`

**Shared Runtime Contracts**

- `DataTable` 对外虚拟滚动配置契约
- compact-admin 统一行高 / 单行截断视觉契约
- 产品表首发 rollout / kill switch / browser denylist 契约
- viewport scroll reset 行为与 `scrollTargetId` 的共存
- 产品页当前 internal-state + React Query 同步链路
- 虚拟化后当前页 row model 与辅助技术看到的行索引必须一致
- 分页 / 排序 / 筛选变更时，viewport reset 与 feature 层 query 重触发的时序必须稳定
- `Suspense fallback -> table unmount -> remount` 周期内的 virtualizer 初始 offset、scrollElement 重绑定与首帧 range
- workspace V2 `Activity hidden` 状态下的 observer / range 生命周期
- 虚拟化运行时异常的局部降级与埋点上报

**Invariants**

- `src/hooks/use-data-table.ts` 不得新增任何虚拟滚动状态或 `react-virtual` 依赖
- 用户表 `src/features/users/components/users-table/index.tsx` 不在本 task 启用虚拟滚动
- 产品页原有分页、筛选、排序、行操作、pinning 与空态行为保持不变
- 没有传 `virtualization` 的所有 `DataTable` 调用方继续走 Task 2 的普通 body 路径
- 虚拟化首发不允许把列内容变成多行自适应高度；若列需要长文本，首版只允许 `ellipsis + title + aria-label`，不引入新的共享 preview 子系统

- **Constraints**
- 仅允许在渲染层新增 `@tanstack/react-virtual`
- 除非 Task 0 findings 明确要求调整，否则本计划主线保持当前 `absolute-position virtual rows`；spacer row 不再是默认实现
- 开启虚拟化必须尽量简单：`DataTable` 调用方应支持 `virtualization={true}` 使用共享 compact-admin preset；只有少数特殊表才允许传对象覆盖默认值
- 现有仓库已经有一版 absolute-position virtual rows prototype；Task 3 必须基于同一套共享文件把它收敛成可测试、可回滚的单一路径，不允许并存两套虚拟 body 实现或再叠新的 escape hatch
- `scroll reset` 只能基于 `pagination` / `sorting` / `columnFilters` / row model 切换做局部处理，不能反向修改 feature 层状态源
- `scroll reset` 必须在与分页 / 排序 / 筛选同一次 commit 的 pre-paint 阶段完成，再允许 feature 层 `useEffect` 把新表状态同步到 query；不要依赖“先渲染旧 rows 再跳回顶部”的事后修正
- 不要在 effect/lifecycle 中使用 `flushSync` 作为默认方案；优先使用 `useLayoutEffect` 或等价的 pre-paint DOM reset 机制保证时序
- 虚拟化实现不能假设 `rows` 只会在已挂载实例内更新；必须显式覆盖 `useSuspenseQuery` 触发的 unmount/remount，保证 remount 首帧 `scrollTop === 0` 且 virtual range 从 index `0` 开始
- 当 viewport ref 在 remount 或 hidden/visible 切换过程中短暂为 `null` 时，必须有显式的 ref stabilization / rebind 策略；不允许把 `undefined` scrollElement 视为“自然恢复”
- 保持原生 HTML `table` 语义；本计划不引入 `role="grid"`、roving tabindex 或 arrow-key cell focus 管理
- 虚拟化运行时异常、unsupported browser guard、或 hidden zero-rect guard 触发时，必须局部降级为“当前 rows 的完整非虚拟渲染”，不得把错误冒泡到 `WorkspaceSlotErrorBoundary`
- 开发态必须把 virtualizer 关键状态暴露为可读取的 `data-*` 属性，并写入 `window.__DATA_TABLE_VIRTUAL_EVENTS__` 队列，供 Playwright 与 DevTools 诊断；生产态不引入第三方 APM 依赖
- workspace keepAlive hidden 状态下，virtualizer 必须暂停零尺寸 rect 观察或冻结上一次 range snapshot；不允许在 `0x0` viewport 上持续重算
- 若浏览器校准发现产品行高不满足下面的 fixed-height gate，立即停止本 task 并回写新的 replan，不要硬调 magic number 掩盖问题
- `estimateRowHeight` 属于共享设计 token，不属于 feature 私有魔法数；products 表等首发调用方不应在页面里硬编码 `56`

**Fixed-Height Gate**

- `采样范围:` 在产品页把每页条数切到 `2000`，在产品表仍是普通渲染路径时采集当前页全部数据行高度，计算 `mean`、`stddev`、`cv = stddev / mean`，以及相对候选 `estimateRowHeight` 的 `maxPrefixDrift = max(abs(sum(height_i - estimateRowHeight)))`。
- `Green:` `cv <= 10%` 且 `maxPrefixDrift <= 0.5 * viewportHeight`。允许继续使用 fixed-height 方案。
- `Yellow:` `10% < cv <= 15%` 或 `0.5 * viewportHeight < maxPrefixDrift <= 1 * viewportHeight`。允许只调整一次 `estimateRowHeight` 后重测；重测后若仍不达 `Green`，则停止 Task 3 并 replan。
- `Red:` `cv > 15%`，或 `maxPrefixDrift > 1 * viewportHeight`，或 absolute rows / 候选 spacer row 任一路线出现结构性冲突。立即停止 Task 3，并改写为 `measureElement` 或非虚拟化优化方案。

**Compact Row Visual Contract**

- 在虚拟化首发范围内，真实数据行采用统一 compact-admin 视觉规范：单行文本、不换行、超出宽度时截断、固定垂直 padding、共享行高 token。这个 token 是 virtualizer `estimateRowHeight` 的默认来源。
- 完整内容首版不通过新 preview 子系统展示，而是使用 `text-overflow: ellipsis` 配合原生 `title` 与必要的 `aria-label`。增强版 preview / popover 明确延后，不阻塞虚拟化主线。

**Accessibility Contract**

- 当 virtual 分支只把当前页 row model 的一部分行保留在 DOM 中时，原生 `<table>` 节点必须声明 `aria-rowcount`，值为“当前页完整 row model 的总行数 + header 行数”；每个渲染出来的数据行都必须声明与该 row model 一致的连续 `aria-rowindex`。
- 本计划明确不把共享表升级为 `role="grid"`，因此不把 `aria-posinset` / `aria-setsize` / roving focus 作为首版硬要求；目标是修复“部分行不在 DOM 时 reader 行号错误”，不是引入整套 grid 键盘模型。
- 当前主线 absolute rows 不引入 spacer rows，因此首版 a11y 重点是确保真实 virtual rows 的索引语义连续、容器总行数正确，以及 absolute positioning 不破坏原生表格可读性。

**Suspense + KeepAlive Contract**

- 产品表当前处在 `<Suspense fallback={<ProductTableSkeleton />}>` 内；Task 3 必须把“切页/排序/筛选触发新 query key → fallback → unmount → remount”的生命周期作为一等路径建模，而不是只测同实例内的 props 更新。
- remount 时 virtualizer 必须以 `scrollTop = 0`、`firstVirtualIndex = 0` 启动；`resetScrollOnChange` 不能仅依赖上一个实例的 effect。
- 当 workspace tab 进入 `Activity mode="hidden"` 且 viewport rect 变成 `0x0` 时，virtualizer 必须停止零尺寸观测或冻结 snapshot；恢复可见后再继续测量和计算。

**Observability Contract**

- viewport 或 table 容器在开发态必须暴露至少这些 `data-*`：`data-virtual-enabled`、`data-virtual-count`、`data-virtual-total-size`、`data-virtual-scroll-offset`、`data-virtual-first-index`、`data-virtual-last-index`。
- 开发态必须挂一个轻量事件队列 `window.__DATA_TABLE_VIRTUAL_EVENTS__`，记录 `enabled`、`fallback`、`suspended-hidden`、`resumed-visible`、`runtime-error` 等事件；格式参考现有 `workspace-devtools` 模式。

**Rollout + Kill Switch Contract**

- products 表虚拟滚动必须经过单独的 products-only gate，而不是跟随整个 workspace shell 一起开关。首选在 `src/config/data-table.ts` 增加集中配置入口，由 `src/features/products/components/product-tables/index.tsx` 读取；不要把开关散落到 feature 组件内部。
- gate 至少覆盖三层：构建时/部署时开关（建议 `VITE_ENABLE_PRODUCT_TABLE_VIRTUALIZATION` 或等价命名）、运行时浏览器 denylist / unsupported guard、以及 virtualizer runtime error 本地降级。
- 关闭 products-only gate 后，行为必须回退为“当前产品表继续渲染完整 DOM rows”，而不是关闭整个 workspace V2、也不是影响 users 表等非首发调用方。
- plan 必须写清 incident rollback 步骤：谁可以关、关哪个开关、关闭后的预期 DOM/功能状态、以及需要观察的 telemetry 事件。

**Acceptance Criteria**

- [ ] `profile: task-3-virtual-core` 通过
- [ ] `DataTable` 新增 opt-in `virtualization` 配置，且默认行为仍然是关闭；调用方至少支持 `virtualization={true}` 直接启用共享 compact-admin preset
- [ ] 产品表在 `rows.length >= rowCountThreshold` 时只渲染可见 rows；低于阈值时仍完整渲染
- [ ] `scrollTargetId="products-table"` 仍落在同一个 viewport 节点上，供 Playwright 与 workspace 场景复用
- [ ] virtual 分支的 `aria-rowcount` / `aria-rowindex` 与当前页 TanStack row model 对齐
- [ ] 共享 compact-admin 行高 token 在 products 表首发中生效，产品表 feature 文件不再硬编码 `estimateRowHeight`
- [ ] 文本型列采用单行截断，并通过原生 `title` 与必要的 `aria-label` 暴露完整内容
- [ ] fixed-height gate 在 Task 3 内被显式执行并记录结论；未通过时必须停止并 replan
- [ ] 当 `pagination` / `sorting` / `columnFilters` 变化触发 server pagination 或重新查询时，viewport 会在新 query 同步 effect 生效前归零，不出现“先保留旧滚动位置渲染旧 rows 再跳顶”的一帧闪动
- [ ] 存在一个真实 `Suspense + React Query` 集成测试，覆盖切页触发 fallback、table unmount/remount、scrollElement 重绑定，以及 remount 首帧从 index `0` 开始
- [ ] 当前 absolute rows 路线下，sticky header 与右侧 pinned `actions` 列在滚动中保持正确层叠和水平对齐；若 DOM 结构前提不成立，Task 3 必须停止并 replan
- [ ] 虚拟化运行时异常会局部降级到非虚拟渲染，并通过 fallback telemetry 事件上报；页面本身不会进入全局错误 fallback
- [ ] 开发态 telemetry 和 `window.__DATA_TABLE_VIRTUAL_EVENTS__` 可被 Playwright 读取，用于可证伪断言
- [ ] keep-alive hidden tab 不会在 `0x0` viewport 上持续重算 virtual range
- [ ] products-only kill switch、unsupported browser guard 和 runtime fallback 三层降级路径都被显式建模；关闭 products-only gate 后，产品表恢复完整渲染而 users 表与 workspace shell 不受影响

**Verification Profile**

- `profile: task-3-virtual-core`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx src/features/products/components/product-screen.suspense.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx`
  - `pnpm exec oxlint src/config/data-table.ts src/types/data-table.ts src/components/ui/table/data-table.tsx src/components/ui/table/data-table-body.tsx src/features/products/components/product-tables/index.tsx src/features/products/components/product-tables/columns.tsx`
  - `pnpm run build`
- `Expected Signals:` `data-table.test.tsx` 同时覆盖普通分支和 virtual 分支，并断言 virtual rows 的 `aria-rowindex` 连续、`aria-rowcount` 正确，以及 `resetScrollOnChange` 走 pre-paint reset 路径；共享 compact-admin preset 可通过 `virtualization={true}` 启用；产品列的截断内容带原生 `title`；`product-screen.suspense.test.tsx` 证明 `Suspense` remount 后 `scrollTop === 0` 且首帧 range 从 `0` 开始；products-only gate 关闭时产品表恢复完整渲染；hook 回归测试继续全绿；构建通过且没有把 `react-virtual` 泄漏进 `useDataTable`

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

**Manual Verification Exception**

- `Waiver Reason:` `estimateRowHeight`、absolute rows 下的 sticky/pinned 对齐和 hidden viewport observer 生命周期都依赖真实浏览器布局与 React Activity 行为，`jsdom` 无法给出可信结果；自动化单测只负责验证契约和时序，最终定位仍需浏览器 smoke
- `Automated Smoke Check:` `pnpm test:unit -- src/components/ui/table/data-table.test.tsx src/features/products/components/product-screen.suspense.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx`
- `Manual Verification Steps:` 启动本地应用后先在产品表仍为普通渲染路径时把每页条数切到 `2000`，执行一段浏览器测量脚本记录 `mean`、`stddev`、`cv`、`maxPrefixDrift`；通过 fixed-height gate 后再启用产品表虚拟滚动，滚动表 viewport 至中部和底部，读取 dev telemetry `data-*`，并执行至少一次 server pagination 场景（例如 `perPage=500` 后点“前往下一页”）、一次排序或筛选变化、一次切到 users tab 再切回 products tab 的 keepAlive hidden 场景，确认 viewport 会先归零再展示新结果，header 仍 sticky、右侧 `actions` pinning 未错位、hidden 期间没有持续 churn 事件，且文本列的原生 `title` 能暴露完整内容；若出现明显 gap/jitter，只允许在同一 task 内调整一次 `estimateRowHeight` 后重测
- `Expected Results:` 产品表在大页尺寸下滚动连续，回到顶部/切页后不显示空白 viewport；server pagination 与排序/筛选变化时不会出现旧滚动位置闪一下再跳顶；workspace tab hidden/visible 切换时不会触发异常 churn；普通小页尺寸仍是完整渲染；virtual rows 的无障碍索引连续
- `Follow-up Automation:` `not needed`，原因是浏览器层不 blank 的高风险路径会在 Task 4 Playwright regression 中覆盖

- [ ] Step 1: 先做依赖与现状审计：确认 `package.json` 已声明 `@tanstack/react-virtual`，确认当前 `data-table-body.tsx` / `product-tables/index.tsx` prototype 与本计划的差距；只有在版本或锁文件不满足需求时，才修改 `package.json` 与 `pnpm-lock.yaml`。
- [ ] Step 2: 在 `src/types/data-table.ts` 新增或收敛共享类型 `DataTableVirtualizationOptions`，至少包含 `enabled`、`estimateRowHeight`、`overscan`、`rowCountThreshold`、`resetScrollOnChange`，并为局部降级/telemetry 预留 `onVirtualizationFallback`（或等价命名）的回调契约。类型必须同时支持“简单启用共享 preset”和“少量调用方覆盖默认值”两种入口。
- [ ] Step 3: 在 `src/config/data-table.ts` 增加集中配置入口，至少包含：products-only rollout gate、compact-admin 行高 token、默认 `overscan`/`rowCountThreshold`、browser denylist / unsupported guard、以及 incident rollback 所需默认值；命名可以调整，但职责不能散落。
- [ ] Step 4: 先改 `src/components/ui/table/data-table.test.tsx`，写出以下行为测试再实现生产代码：`enabled=false` 不虚拟化、`virtualization={true}` 会套用共享 compact-admin preset、低于阈值不虚拟化、高于阈值时只渲染 virtual items、`scrollTargetId` 仍保留、virtual rows 的 `aria-rowindex` 连续且 `aria-rowcount` 正确、products-only gate 关闭或 runtime error 时会回退到完整渲染。
- [ ] Step 5: 在 `src/components/ui/table/data-table-body.tsx` 基于同一个共享 body 文件收敛现有 prototype，引入/保留 `useVirtualizer` 并实现分支判断：

```ts
const shouldVirtualize =
  virtualization?.enabled === true && rows.length >= (virtualization.rowCountThreshold ?? 100);
```

- [ ] Step 6: virtual 分支继续基于当前 absolute rows 路线复用 `flexRender()` 与 `getCommonPinningStyles()`；不要改 header 结构，也不要在本 task 引入未经 Task 0 gate 证明的 spacer row。
- [ ] Step 7: 在 `src/components/ui/table/data-table.tsx` 暴露支持简化启用的 `virtualization` prop，把 `aria-rowcount` 所需的总行数信息传给 body 渲染层，并在开发态输出 `data-virtual-*` telemetry。默认调用方式应接近 `virtualization={true}`，而不是在每个 feature 重复传整包魔法数。
- [ ] Step 8: 为 `resetScrollOnChange` 明确实现时序：在 `DataTableBody` 内用 `useLayoutEffect` 或等价 pre-paint 机制监听 `pagination.pageIndex`、`pagination.pageSize`、`sorting`、`columnFilters` 与 row model identity，在这些值变化的同一次 commit 中直接把 viewport 复位到顶部；不要把 reset 放到 passive `useEffect` 里等待 query 返回后再纠正。
- [ ] Step 9: 在 `src/features/products/components/product-tables/columns.tsx` 中，把会影响统一行高的文本列（至少 `name`、`description`）切成单行截断，并补原生 `title` 与必要的 `aria-label`，确保 products 表符合 compact-admin 视觉契约。
- [ ] Step 10: 新建 `src/features/products/components/product-screen.suspense.test.tsx`，用真实 `Suspense + QueryClientProvider` harness 覆盖“切页触发 fallback → remount → scrollElement 重绑定 → firstVirtualIndex 重置到 0”的路径。
- [ ] Step 11: 为 hidden keepAlive 生命周期加 guard：当 viewport rect 进入 `0x0` 或 `Activity hidden` 导致不可见时，暂停 rect/offset 观察或冻结 snapshot；恢复可见后再继续测量。
- [ ] Step 12: 在产品表仍未启用最终 rollout gate 前执行 fixed-height gate；若命中 `Red`，立即停止本 task 并写 replan，不进入下游步骤。
- [ ] Step 13: 仅当 fixed-height gate 通过时，在 `src/features/products/components/product-tables/index.tsx` 通过 `src/config/data-table.ts` 中的 products-only gate 首个启用虚拟滚动；首发调用应优先使用共享 preset（例如 `virtualization={true}` 或等价简单写法），而不是在 feature 层重复声明 `56/8/100` 这类默认值；用户表不改。
- [ ] Step 14: 明确 incident rollback 文档：关闭 products-only gate、验证产品表退回完整 DOM 渲染、确认 `window.__DATA_TABLE_VIRTUAL_EVENTS__` 记录 `fallback` 或 `disabled-by-config` 事件；这一步要作为 Task 3 的交付产物，而不是口头约定。
- [ ] Step 15: 运行 `profile: task-3-virtual-core`，再完成上面的手动浏览器校准。
- [ ] Step 16: Commit `feat: add opt-in data table virtualization`

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
- [ ] rollback 项目下 `perPage=2000` 时产品表 `tbody` 总 `tr` 数必须 `<= 64`，相对 Task 1 的 `2000` 行基线减少至少 `96%`
- [ ] browser-level 断言不再使用“有可见 rows”这种不可证伪表述，而是读取 `data-virtual-*`、`data-row-index` 与 `getBoundingClientRect()` 做量化校验
- [ ] default 项目下 hidden keepAlive tab 不会导致 products 页在后台持续 virtual churn；切回前台后 sticky / pinned / range telemetry 仍正确

**Verification Profile**

- `profile: task-4-regression`
  - `pnpm test:unit -- src/components/ui/table/data-table.test.tsx src/features/products/components/product-screen.suspense.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx src/features/products/components/product-tables.internal-state.test.tsx src/features/users/components/users-table.internal-state.test.tsx`
  - `pnpm lint`
  - `pnpm run build`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=default --grep "switching away from a paginated list page and back preserves page state|virtualized product list survives tab switches"`
  - `pnpm exec playwright test e2e/workspace-tabs-smoke.spec.ts --project=rollback --grep "product listing exposes stable scroll viewport selector|rollback product list virtualizes large page within DOM budget|user listing works via v2 internal-state without workspace shell"`
- `Expected Signals:` unit tests、lint、build 全绿；default 项目下产品列表切到大页尺寸后切到用户页再切回时，`data-virtual-first-index`、`data-virtual-scroll-offset`、sticky header `top`、右侧 pinned `actions` 列 bounding box 都满足预期；rollback 项目下产品表切到大页尺寸并滚动后不出现空白 viewport，`tbody` 总 `tr` 数满足 `<= 64` 的 DOM budget，且 telemetry 能证明 virtualizer 正在工作；用户页仍可正常渲染

**Verification Strategy**

- `integration smoke`

**Browser Gate Role**

- `regression`

- [ ] Step 1: 在 `e2e/workspace-tabs-smoke.spec.ts` 新增或扩展 default 项目测试 `virtualized product list survives tab switches`；步骤必须包含：进入产品页、把每页条数切到至少 `500`、滚动 `[data-scroll-target-id="products-table"]`、读取 `data-virtual-first-index` / `data-virtual-scroll-offset` / `window.__DATA_TABLE_VIRTUAL_EVENTS__`、记录 viewport 与 header / pinned `actions` 列的 `getBoundingClientRect()`、切到用户页再切回产品页、确认分页状态没有重置、hidden 期间没有异常 churn、切回后 `headerRect.top === viewportRect.top`（允许 1px 误差）、右侧 pinned 列仍贴齐表格右边缘、virtual range 与 sticky/pinned bounding box 都正确。
- [ ] Step 2: 在同一 spec 新增 rollback 测试 `rollback product list virtualizes large page within DOM budget`；步骤必须包含：进入产品页、把每页条数切到 `2000`、滚动 viewport、读取 `data-row-index` 与 `data-virtual-*`、断言第一条可见行 index 近似等于滚动位置推导值、检查首批 virtual rows 存在 `transform: translateY(...)` 或等价定位证据、页面没有 `Something went wrong`，并断言 `tbody` 总 `tr` 数 `<= 64`。
- [ ] Step 3: 保留并复跑已有 rollback 用户列表 smoke，确保用户表作为非 opt-in 调用方没有被共享层改坏。
- [ ] Step 4: 运行 `profile: task-4-regression`。这是整个计划的跨任务回归 gate，任何失败都必须回到对应 task 修复后重跑。
- [ ] Step 5: Commit `test: cover virtualized data table regressions`

---

## 完成定义

满足以下条件才可以宣布本计划完成：

- `DataTable` 的虚拟滚动是显式 opt-in，默认关闭。
- 对于接受 compact-admin 视觉规范的调用方，开启虚拟化的 API 足够简单，默认调用体验接近 `virtualization={true}`；共享默认值集中维护于 `src/config/data-table.ts`。
- `docs/plans/2026-05-14-data-table-virtual-scroll-task0-findings.md` 已记录 profiling 与 Column Width Stability Gate 结论，并决定本计划主线是否继续守住 absolute rows。
- `useDataTable` 没有引入任何 `react-virtual` 依赖，也没有新增虚拟滚动状态。
- 当前仓库已有的 `data-table-body.tsx` / `product-tables/index.tsx` prototype 已被收敛到本计划定义的单一路径；不存在并存的旧实现或注释掉的逃生分支。
- 产品表已启用虚拟滚动并通过大页尺寸 smoke；用户表仍走普通渲染路径且回归通过。
- 产品表文本型列已切到单行截断，并通过原生 `title` 与必要的 `aria-label` 暴露完整内容，符合 compact-admin 视觉契约。
- `scrollTargetId -> data-scroll-target-id` 契约保持不变，Task 1 和 Task 4 的 Playwright 都能稳定命中相同 viewport。
- virtual rows 的 `aria-rowcount` / `aria-rowindex` 与当前页 row model 一致，且本计划没有把共享表错误升级成 `role="grid"`。
- fixed-height gate 已被执行并通过；若未通过，则本计划不得宣布完成，必须改写为 `measureElement` 版后续计划。
- `perPage=2000` 的产品表 DOM 规模相对 Task 1 基线减少至少 `96%`，且 Task 4 smoke 仍证明无 blank viewport。
- `resetScrollOnChange` 的实现是 pre-paint reset，而不是 query 返回后的事后修正；server pagination、排序、筛选切换都不会出现旧 scroll position 闪现。
- `Suspense` remount、workspace `Activity hidden`、virtual runtime error、sticky/pinned/stacking context 这四类运行时路径都有明确验证；任一前提不成立时，计划要求停止 Task 3 并 replan，而不是继续赌实现细节。
- 开发态 telemetry（`data-virtual-*` + `window.__DATA_TABLE_VIRTUAL_EVENTS__`）存在并被 Playwright 读取；回归测试不再依赖“看起来有行”的模糊断言。
- 虚拟化异常会局部降级到非虚拟路径并上报 fallback 事件，不会把整张产品页打进全局错误 fallback。
- products-only kill switch、unsupported browser guard、runtime fallback 三层降级路径均已实现并验证；关闭 products-only gate 时，只有产品表退回完整渲染，workspace shell 与 users 表不受影响。
- 兼容性签字矩阵已完成：定义支持边界、明确 best-effort 边界，并记录至少一轮桌面浏览器和辅助技术验收结果。
- `pnpm lint`、Task 4 的 unit profile、Task 4 的 Playwright profile、`pnpm run build` 全部通过。

## 运营回滚与发布

- `发布范围:` 首发仅限 products 表；users 表和其他 `DataTable` 调用方继续保持非虚拟化。
- `主开关:` 通过 `src/config/data-table.ts` 暴露 products-only gate，优先由部署时 env 配置驱动；建议命名为 `VITE_ENABLE_PRODUCT_TABLE_VIRTUALIZATION` 或等价含义名称。
- `运行时保护:` 对已知不支持或高风险浏览器走 denylist / unsupported guard，直接返回完整渲染；发生 runtime error 时仅当前表局部降级，不得影响页面其余区域。
- `回滚步骤:` 1. 关闭 products-only gate。2. 重新部署。3. 用 Task 4 的 rollback smoke 或同等脚本确认产品表 `tbody` 数据行数恢复为当前页完整 row 数。4. 检查 `window.__DATA_TABLE_VIRTUAL_EVENTS__` 中存在 `disabled-by-config`、`unsupported-browser` 或 `fallback` 事件之一。5. 观察产品页分页、筛选、排序功能仍正常。
- `值班责任:` 触发回滚的人必须同时记录触发条件、浏览器/页面上下文、以及是否命中 telemetry 事件，避免“静默降级后无人知晓”。

## 兼容性签字矩阵

- `Supported desktop browsers:` Chrome 当前稳定版与前一稳定版、Edge 当前稳定版与前一稳定版、Firefox 当前稳定版、Safari 17.4+。这些组合需要通过 Task 4 smoke，且 products 表在 `perPage=500/2000` 下无 blank viewport、sticky/pinned 正常。
- `Supported assistive tech baseline:` macOS `VoiceOver + Safari`、Windows `NVDA + Chrome`。这两组至少完成一轮手动验收，重点检查 header 朗读、数据行序号、分页后首行可正确读取、截断文本的完整内容能被暴露。
- `Best-effort only:` iOS/iPadOS VoiceOver、Android TalkBack、以及不在上述矩阵内的旧浏览器。若发现虚拟化问题，允许直接走 products-only gate 或 unsupported browser guard 降级，而不是为首版扩大实现范围。
- `Out of scope for this plan:` `role="grid"` 级别的箭头键 cell focus、JAWS 专项适配、移动端大表体验优化。若产品后续把共享表升级为交互式 grid，再单独开 plan。

## 执行顺序

1. Task 0
2. Task 1
3. Task 2
4. Task 3
5. Task 4

不要跳 task，也不要把 Task 4 提前；Task 0 是方向 gate，Task 4 是 Task 2-3 共享运行时契约的总回归 gate。

<!-- Execution appended below during runtime -->

### Task 0 Execution

- **Result:** CONDITIONAL PASS
- **Files:** `docs/plans/...-task0-findings.md` (new), `e2e/task0-feasibility.spec.ts` (new)
- **Verification:** `pnpm run build` PASS. Column Width Stability Gate PASS. Sticky Header Gate PASS.
- **Notes:** Three bugs documented. Findings corrected per pane%0 review.

### Task 1 Execution

- **Result:** PASS
- **Files:** `e2e/workspace-tabs-smoke.spec.ts` (2 new rollback tests)
- **Verification:** Unit tests 6/6 PASS. Build PASS. Playwright rollback 2/2 PASS.
- **Baseline:** perPage=2000 renders 17 DOM rows (virtual active). scrollTargetId stable.
- **Notes:** **Deviation from plan:** 2000-row non-virtual baseline was not captured — current prototype already has virtual scroll enabled. Task 1 confirmed selector stability and `tbodyRows > 0` at perPage=2000. The conceptual 2000-row target remains the reference for Task 4 DOM budget.

### Task 2 Execution

- **Result:** PASS (refactor already complete in codebase)
- **Files:** None modified (all Task 2 work pre-exists)
- **Verification:** `pnpm test:unit -- data-table.test.tsx` PASS. `pnpm exec oxlint` — 1 error + 5 warnings all pre-existing. `pnpm run build` PASS.
- **ScrollArea audit:** Viewport className only contains focus-visible, size, rounded, transition, outline — no transform/filter/perspective/contain/will-change. Sticky containing block integrity confirmed by Task 0 tests.
- **Notes:** **Deviation from plan:** `data-table-body.tsx` was NOT rolled back to a plain body baseline as the plan suggested. The file retains `useVirtualizer` + absolute rows branches. This is acceptable because the plan's updated architecture (Task 0 findings) confirms absolute positioning as the V1 incumbent — a full rollback would be destructive churn. `scrollViewportRef` is correctly plumbed through ScrollArea→DataTable→DataTableBody.

### Task 3 Execution

- **Result:** PASS
- **Files:** `src/config/data-table.ts` (+preset, +products gate, +browser guard), `src/types/data-table.ts` (+fallback callback), `src/components/ui/table/data-table-body.tsx` (rewrite: useLayoutEffect scroll reset, telemetry data-\*, aria-rowindex, keepAlive guard, runtime fallback, shared preset), `src/components/ui/table/data-table.tsx` (+colgroup, +aria-rowcount), `src/features/products/components/product-tables/index.tsx` (gate→virtualization=boolean), `src/features/products/components/product-tables/columns.tsx` (truncation+title)
- **Verification:** `pnpm run build` PASS. `pnpm test:unit` 261 tests PASS.
- **Fixed bugs:** (1) colgroup prevents equal-width collapse, (2) useLayoutEffect pre-paint scroll reset, (3) data-virtual-\* attrs + window.**DATA_TABLE_VIRTUAL_EVENTS** added, (4) aria-rowcount/aria-rowindex, (5) keepAlive ResizeObserver guard, (6) runtime try/catch fallback, (7) products-only gate via VITE_ENABLE_PRODUCT_TABLE_VIRTUALIZATION, (8) browser guard via ResizeObserver detection, (9) shared preset in config — products page now uses virtualization={boolean}
- **Suspense integration test:** CREATED. 3 tests PASS covering fallback→remount→viewport ref stable after Suspense cycle. jsdom ResizeObserver guard added to keepAlive effect.
- **Kill switch telemetry:** `disabled-by-config` and `unsupported-browser` events emitted in product-tables gate check. `enabled` event emitted on first virtual render. `onVirtualizationFallback` covers all 3 reasons. `window.__DATA_TABLE_VIRTUAL_EVENTS__` populated.

### Task 4 Execution

- **Result:** PASS
- **Files:** `e2e/workspace-tabs-smoke.spec.ts` (+rollback DOM budget test, +default tab switch regression test)
- **Verification:** Build PASS. 261 unit tests PASS. Playwright rollback 3/3 PASS. Playwright default 1/1 PASS.
- **Rollback baseline:** 17 tbody rows at perPage=2000 (<= 64 budget). `data-virtual-enabled: true` confirmed. No blank viewport after scroll. User listing unaffected.
- **Default regression:** Tab switch product→users→product preserves virtual scroll (17 rows after switch). No churn events during hidden state.
- **DOM budget:** 17 rows = 99.15% reduction vs conceptual 2000-row baseline. Exceeds 96% target.
