# Task 09：Date Editor

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** Task 08

**Blocks:** Task 10

**Type:** feature

## Goal

交付严格 `YYYY-MM-DD` 领域契约的 Date Editor，让手工输入和 Calendar 选择共用同一 draft、codec、约束和提交管线，并在完整可访问性及虚拟化验证后开放 `date` public gate。

## Files

- Create: `src/components/data-table/cells/data-table-editable-date-cell.tsx`
- Create: `src/components/data-table/cells/data-table-editable-date-cell.test.tsx`
- Modify: `src/components/data-table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/data-table/columns/data-table-edit-codecs.test.ts`
- Modify: `src/components/data-table/columns/data-table-edit-adapters.ts`
- Modify: `src/components/data-table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/data-table/columns/data-table-column-builders.tsx`
- Modify: `src/components/data-table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/elements/components/data-table-editable-choice-contract-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

## Invariants

- row date 值是严格 `YYYY-MM-DD | null` 字符串。
- 不把 date 存为 `Date`。
- 不通过 UTC 午夜或 `new Date('YYYY-MM-DD')` round-trip。
- 手工输入与 Calendar 选择调用同一 codec 和 unavailable/min/max 校验。
- popup 复用现有 `Popover`、`Calendar` 和 workspace overlay container。
- Date Editor 接管整个 cell，不让 popup 被 table overflow 裁剪。

## Interaction Contract

- 双击、Enter、F2：进入编辑并聚焦文本输入。
- 默认不自动打开 Calendar。
- Calendar 按钮或 Alt+ArrowDown：打开日历。
- 选择合法日期：立即提交。
- 手工输入：Enter、Tab 或 blur 完成。
- Escape：取消整个 cell session。
- 关闭后焦点返回原 cell/editor。

## Out of Scope

- 不处理时间或时区。
- 不把 date 筛选 DSL 与 editable date 混为同一实现。
- 不抽象尚未由 DateTime 证明的过度通用 Temporal Editor。

## Acceptance Criteria

- [x] 闰年、不存在日期、min/max 和 unavailable 规则通过。
- [x] 输入和 Calendar 对相同日期产生相同领域值。
- [x] `allowEmpty` 和 nullable 字段类型约束在编译期生效。
- [x] Calendar roving tabindex、accessible name、错误描述和焦点恢复通过。
- [x] popup 内点击/滚动不驱动 range selection。
- [x] valid/invalid detach 和 stale popup session 通过。
- [x] 全部 gate 条件通过后才公开 `date`。

## Verification Profile

```bash
pnpm exec vitest run src/components/data-table/cells/data-table-editable-date-cell.test.tsx src/components/data-table/columns/data-table-edit-codecs.test.ts src/components/data-table/columns/data-table-edit-adapters.test.ts src/components/data-table/columns/data-table-column-factory.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先补严格 date parser、字段类型和 Calendar 交互失败测试。
2. 实现 date codec 和 adapter，保持 gate 关闭。
3. 实现手工输入与 Calendar 共用 draft 的 editor。
4. 接入 overlay、keyboard shell、anchor lifecycle 和可访问性。
5. 扩展示例页和 browser smoke。
6. 完成全部退出条件后打开 `date` gate。
7. 完成统一 Review 与父设计状态回写。

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 已交付严格 civil date parser 与 column-bound date codec；row、snapshot 和 change event
  始终保存 `YYYY-MM-DD | null`，Calendar 只通过本地年月日分量转换，未使用
  `new Date('YYYY-MM-DD')` 或 UTC 午夜 round-trip。
- 手工输入、Calendar 选择、single-cell paste 和 raw / typed programmatic write 共用
  同一 parse / validate / commit 管线；闰年、不存在日期、min / max、row-aware
  unavailable 与 `allowEmpty` 均有回归覆盖。
- 已复用 `Popover`、`Calendar`、workspace overlay container、keyboard shell 和 anchor
  lifecycle；补充了弹层自动聚焦导致 input blur 提前提交的竞态保护，并验证 roving
  tabindex、accessible name、错误描述、焦点恢复、popup 事件隔离和 stale session。
- 为保证严格 date 展示不发生时区漂移，额外调整共享 date display formatter：
  `YYYY-MM-DD` 直接展示，其他既有输入仍保持原格式化路径。
- 示例页与 browser smoke 已覆盖手工非法日期、Alt+ArrowDown、不可选日期、Calendar
  选择、领域快照和虚拟列表恢复；全部退出条件满足后才开放 `date` public gate。

### 验证结果

- 任务目标 Vitest 与 keyboard shell 补充回归通过：6 个测试文件、86 个测试。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过：0 warning、0 error。
- Task 09 目标文件 `oxfmt --check` 通过。
- `pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2`
  通过：2 个浏览器测试；其 pretest production build 同时通过。

### 阻塞项或未预期技术债务

- 无 Task 09 产品阻塞项。
- 外部文档检索服务在开发期间达到月度配额；实现依据仓库锁定的
  `react-day-picker@9.14.0` 类型声明与现有 Calendar 封装完成验证，不影响交付。

### 后续行动项（Action Items）

- `TODO (P1)`：Task 10 仅在 instant / local、显式时区和 DST 语义被测试证明后抽取
  Temporal 共享层；不得提前把 Date Editor 泛化成含混的日期时间状态机。
- `TODO (P2)`：Phase 6 matrix paste 继续复用本 task 的严格 date codec，并在
  `PastePlan` 中保留具体失败坐标。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 根据产品格式收口要求，将 `date` 的固定可见格式 `YYYY-MM-DD` 集中定义在
  `src/config/data-table.ts`，单元格展示与 clipboard copy 统一消费该配置。
- 根据产品明确反馈调整原 Interaction Contract：纯 Date 进入编辑后直接打开 Calendar，
  不再在日历顶部展示文本输入框，也不再要求二次点击或 `Alt+ArrowDown` 打开日历；
  合法日期选择仍立即提交，Escape / outside close 仍取消 session。
- 新增 DataTable temporal calendar 布局配置：月份导航固定在标题两侧，星期和日期均为
  七列等宽布局，month grid 在弹窗内铺满可用内容宽度。
- `date` 继续保持纯 civil date 语义，不展示、读取或附加时区；row、snapshot 与
  change event 的 `YYYY-MM-DD | null` 领域契约未变化；paste 与 programmatic write
  仍通过严格 date codec 提供文本写入能力。

### 验证结果

- Numeric、Date、DateTime 编辑器定向 Vitest 通过：3 个测试文件、17 个测试。
- `pnpm typecheck`、`pnpm lint` 与目标文件 `oxfmt --check` 通过。
- 表格编辑与范围选择 Playwright 回归通过：11 个浏览器测试；production build 通过。
- 浏览器截图确认 Calendar 自动打开、无顶部 Date input、月份导航位置正确且七列等宽。

### 阻塞项或未预期技术债务

- 无新增产品阻塞或依赖。

### 后续行动项（Action Items）

- `TODO (P2)`：如未来调整日期可见格式，必须同步修改集中配置与
  display/clipboard 回归，禁止业务列分散覆盖默认格式。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 修复共享 Calendar 选中日期的视觉优先级：`react-day-picker@9.14.0` 将 selected
  modifier 放在 day 容器而非按钮，现由 selected modifier 直接约束子按钮的默认、
  hover 与 focus-visible 前景/背景色。
- Date codec 的格式、必填、min/max 和 unavailable 提示改为中文消息目录，日期领域值
  和无时区展示契约未变化。
- printable-key 产生非法日期草稿时改由 Calendar 弹层直接展示可访问错误提示，未恢复
  已移除的完整日期文本输入。

### 验证结果

- 编辑示例 Playwright 3 / 3 通过；新增计算样式断言证明选中日期 hover 前后背景色
  保持一致，production build 通过。
- 相关定向 Vitest、typecheck、lint 与格式检查通过。

### 阻塞项或未预期的技术债务

- 无新增阻塞或依赖。

### 后续行动项（Action Items）

- `TODO (P2)`：升级 `react-day-picker` 或重生成 shadcn Calendar 时，必须重验 selected
  modifier 所在 DOM 与 hover 计算样式，不能只断言 className。
