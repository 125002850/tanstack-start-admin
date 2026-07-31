# Task 10：DateTime Editor

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** Task 09

**Blocks:** Task 11

**Type:** feature

## Goal

在 Date Editor 已验证的 Temporal 基础上交付 `dateTime`，严格区分 instant 与 local 领域语义，完成显式时区解析、DST gap/overlap 校验、时间输入和 explicit-confirm 生命周期。

## Files

- Create: `src/components/data-table/columns/data-table-time-zone.ts`
- Create: `src/components/data-table/columns/data-table-time-zone.test.ts`
- Modify: `src/components/data-table/cells/data-table-editable-date-cell.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-date-cell.test.tsx`
- Modify: `src/components/data-table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/data-table/columns/data-table-edit-codecs.test.ts`
- Modify: `src/components/data-table/columns/data-table-edit-adapters.ts`
- Modify: `src/components/data-table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/data-table/columns/data-table-column-builders.tsx`
- Modify: `src/components/data-table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/elements/components/data-table-editable-choice-contract-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

如 Date 与 DateTime 的 UI 在实现中证明无法保持单一组件清晰，可在 Review 前提出拆分 `data-table-editable-date-time-cell.tsx`；不得在无证据时预先复制整套 Temporal 生命周期。

## Invariants

- `valueKind: 'instant' | 'local'` 必填，禁止通过字符串形状推断。
- instant 使用带 `Z` 或 offset 的规范 ISO 字符串。
- local 使用无时区的规范 local datetime 字符串，不调用 `toISOString()`。
- instant 时区按 column → table → app 解析。
- 不 fallback 到浏览器、服务器或用户机器时区。
- column-bound codec 创建时固定 resolved time zone。
- 缺失或非法时区：开发/测试抛出可定位错误；生产 fail closed 并禁用该列编辑。
- DST gap invalid；overlap 未明确 offset/disambiguation 时 invalid。

## Interaction Contract

- popup 包含 Calendar、时间输入、确定、取消和可选清除。
- 选择日期不立即提交。
- 空值首次选日期使用 `defaultTime`。
- Enter 在时间合法时确认。
- Escape 取消整个 session。
- 点击确定统一 parse、validate、commit。
- virtual detach 时 explicit-confirm session revert。

## Dependency Gate

本 task 默认复用现有依赖。如果无法在当前依赖面内正确实现 IANA 时区和 DST overlap/gap：

1. 停止实现。
2. 记录具体失败样本和当前依赖能力缺口。
3. 提交单独的架构/依赖决策。
4. 不在本 feature task 中夹带依赖新增或升级。

## Out of Scope

- 不在业务页面分散编写 `new Date(rawValue)` 适配。
- 不自动选择 DST overlap 的 `earlier` 或 `later`。
- 不支持未定义语义的后端裸 `YYYY-MM-DD HH:mm:ss` 直接写入。

## Acceptance Criteria

- [x] instant/local round-trip 均保持领域语义。
- [x] column/table/app 时区优先级和 source 可测试。
- [x] 缺失/非法时区 fail closed。
- [x] DST gap、overlap、offset string 和 UTC `Z` string 测试通过。
- [x] minute/second granularity、step、min/max 和 defaultTime 通过。
- [x] explicit-confirm、取消、outside close 和 detach 生命周期通过。
- [x] API 非规范字符串只在共享 adapter/codec 边界归一化。
- [x] 全部 gate 条件通过后才公开 `dateTime`。
- [x] V1 统一出口验证通过。

## Verification Profile

```bash
pnpm exec vitest run src/components/data-table/columns/data-table-time-zone.test.ts src/components/data-table/cells/data-table-editable-date-cell.test.tsx src/components/data-table/columns/data-table-edit-codecs.test.ts src/components/data-table/columns/data-table-edit-adapters.test.ts src/components/data-table/columns/data-table-column-factory.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

V1 出口：

```bash
pnpm check
pnpm build
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先补 resolver、instant/local、DST 和 explicit-confirm 失败测试。
2. 实现时区 resolver；若依赖能力不足，执行 Dependency Gate。
3. 扩展 Temporal codec 和 editor，保持 gate 关闭。
4. 接入 API 边界、overlay、keyboard shell 和 detach lifecycle。
5. 扩展示例页和 browser smoke。
6. 完成 V1 出口验证后打开 `dateTime` gate。
7. 完成统一 Review 与父设计状态回写。

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 已新增 `resolveDataTableTimeZone()`，严格按 column → table → app 解析并返回 source；
  高优先级非法配置不会静默降级。开发/测试抛出包含 tableId、columnId 与 fallback
  chain 的错误，production 捕获后记录错误并让 adapter 返回 `null`，保持 display
  且禁用编辑。
- 在未新增依赖的前提下，使用 `Intl.DateTimeFormat` 的 IANA wall-clock 分量完成
  instant 转换，并通过真实 `America/New_York` 样本区分 unique、DST gap 与 overlap；
  overlap 未带 offset 时保持 invalid，显式 `-04:00` / `-05:00` 与 UTC `Z` 均在共享
  codec 边界规范化为 UTC ISO。
- local 始终保存无时区 canonical local string，不读取时区链或调用 `toISOString()`；
  instant/local 的 minute/second granularity、整数 step、min/max、defaultTime、
  nullable 和 programmatic write 共用 column-bound codec。
- Date 与 DateTime 的提交生命周期被实现证明不同，因此按 task 允许的分支新增
  `data-table-editable-date-time-cell.tsx`：Date 选日立即提交；DateTime popup 保留
  Calendar、时间输入、清除、确定与取消，并仅显式确认提交，outside close 与
  virtualization detach 均 revert。
- `createDataTableColumnDsl()` 新增可选 `tableId`、`tableTimeZone` 与 `appTimeZone`
  绑定上下文；`valueKind` 在类型与 runtime 均必填，local 配置 column timeZone
  在编译期拒绝。
- 示例页与浏览器 smoke 同时覆盖 instant/local、领域快照、step 错误、确定提交和
  10,000 行虚拟列表卸载；全部退出条件满足后才开放 `dateTime` public gate。

### 验证结果

- Task 10 目标 Vitest（含拆分后的 DateTime component）通过：7 个测试文件、94 个测试。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过：0 warning、0 error。
- Task 10 目标文件 `oxfmt --check` 与 `git diff --check` 通过。
- `pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2`
  通过：2 个浏览器测试；production build 通过。
- `pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2`
  通过：5 个浏览器测试；production build 再次通过。
- `pnpm check` 的 lint 与 typecheck 通过；全仓 unit 共 92 个文件、801 个测试，
  90 个文件 / 799 个测试通过，只有下述两个既有基线失败。

### 阻塞项或未预期技术债务

- `pnpm check` 仍受 Task 06 已记录的两个无关基线失败阻塞：
  `management-toolbar-contract.test.ts` 的 department tableActions contract，以及
  `dictionary-management-page.test.tsx` 的字典项状态切换确认文案查找；本 task 未修改
  对应生产代码或测试。
- 外部文档检索服务达到月度配额；dependency gate 改以锁定运行时的
  `Intl.DateTimeFormat` 能力 spike、TypeScript 声明和 DST 固定样本验证，未引入
  依赖或依赖升级。

### 后续行动项（Action Items）

- `TODO (P1)`：如产品需要在 UI 内编辑 DST overlap，单独增加显式 offset /
  disambiguation 选择器；V1 继续 fail closed，不默认 earlier 或 later。
- `TODO (P2)`：如需支持历史上秒级 offset 的罕见 IANA 时区，扩展 resolver 的
  精度与样本集；当前 V1 领域 granularity 最大到 second，现代业务时区样本已覆盖。
- `TODO (P2)`：后端裸 `YYYY-MM-DD HH:mm:ss` 的兼容必须放在共享 API adapter，
  不得回流到业务列或放宽 DateTime codec 的 canonical contract。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 根据产品格式收口要求，将 DateTime 的用户可见格式固定为
  `YYYY-MM-DD HH:mm:ss`，并与 Date 格式一并集中定义在
  `src/config/data-table.ts`。
- DateTime 编辑输入、单元格展示和 clipboard copy 现在使用同一固定格式；minute
  granularity 以 `:00` 补齐秒，second granularity 保留实际秒值。
- 编辑弹层不再展示 IANA 时区及配置来源，只展示格式说明。instant 仍在 column-bound
  codec 内使用显式时区完成 wall-clock 转换和 DST 校验；local/instant 的 row、
  snapshot、change event 继续保存原 canonical 领域值。
- 为保持向后兼容，programmatic write 与 paste 仍可在 codec 边界消费既有 canonical
  `T` 格式；固定空格格式是用户界面契约，不把后端裸字符串误判为已定义领域语义。
- DateTime Calendar 复用 DataTable temporal calendar 的整宽七列与标题导航布局；
  根据后续产品反馈移除弹层顶部的完整日期时间文本 Input，改为 Calendar + 原生
  `type="time"` 时间控件 + 显式确认；不跟随纯 Date 改成选日立即提交。

### 验证结果

- 日期/日期时间相关目标 Vitest 通过：7 个测试文件、100 个测试。
- `pnpm typecheck` 与 `pnpm lint` 通过。
- 编辑示例 Playwright smoke 通过：3 个测试；production build 同时通过。
- 区间选择 Playwright smoke 通过：8 个测试，覆盖 copy、matrix paste 与 fill 回归。
- 本次 UI follow-up 的 Numeric、Date、DateTime 定向 Vitest 通过：3 个文件、17 个
  测试；两组 Playwright 合计 11 个测试通过，并完成 Calendar 视觉截图复核。
- DateTime 顶部文本 Input 移除后的 Date/DateTime 定向 Vitest 通过：2 个文件、11 个
  测试；编辑示例 Playwright 通过 3 个测试，production build 同时通过。

### 阻塞项或未预期技术债务

- instant 的正确解析仍依赖内部显式 IANA 时区；本次只移除用户界面的时区展示，
  未删除 correctness 所需的时区解析与 DST fail-closed。

### 后续行动项（Action Items）

- `TODO (P2)`：如未来后端正式采用裸 `YYYY-MM-DD HH:mm:ss` 作为领域协议，必须先
  明确 instant/local 语义并在共享 API adapter 归一化，不得直接放宽 row contract。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- DateTime Calendar 同步获得 selected 高于 hover/focus 的共享视觉修复。
- DateTime 的固定格式、step、min/max、DST gap/overlap 和 value kind 错误已切换为中文
  消息目录；IANA 时区仍仅用于内部 correctness，不恢复界面时区展示。

### 验证结果

- DateTime component 与 codec 包含在 9 个文件、117 个定向测试中并通过；编辑示例
  Playwright 3 / 3 通过。

### 阻塞项或未预期的技术债务

- 无新增阻塞；DST 错误文案仍包含 IANA 时区标识，属于定位歧义所需信息而非时区展示
  功能回退。

### 后续行动项（Action Items）

- `TODO (P1)`：正式 I18N 时为 DST gap / overlap 保留结构化 timeZone 参数，禁止从
  已格式化字符串反向解析。
