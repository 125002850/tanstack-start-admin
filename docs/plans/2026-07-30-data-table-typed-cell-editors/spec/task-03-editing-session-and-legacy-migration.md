# Task 03：Editing Session 与 Legacy 迁移

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** Task 02

**Blocks:** Task 04

**Type:** runtime

## Goal

把 editing runtime 一次性迁移为 `draftValue + parseState + candidateValue + validationErrors`，建立统一 `commitCandidate()` 和结构化 finish result，并让 text、choice、switch 通过新管线保持原有行为。

## Files

- Modify: `src/types/data-table.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-value-cell.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-value-cell.test.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-choice-cell.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-choice-cell.test.tsx`
- Modify: `src/components/data-table/core/use-data-table-cell-selection.ts`

## Invariants

- 不保留两套可写 session 真相源。
- `parseState` 是 candidate 是否可用的唯一判别依据；不能通过 optional `candidateValue` 猜测。
- `getDisplayRow()` 只在 `parseState === 'valid'` 时合并 candidate。
- active draft 不进入 `getSnapshot()` 或 `hasChanges()`。
- `commitCandidate()` 执行 validate、typed update 和 change event。
- switch 不伪造 editing session，直接提交 typed candidate。
- `editing.onChange`、snapshot 和 controller 外部契约保持兼容。

## Required Results

`finishEditing()` 至少可区分：

- `committed`
- `unchanged`
- `blocked`
- `reverted`
- `stale-session`

旧 session 的异步或延迟事件必须返回 `stale-session`，不得改变当前 session。

## Out of Scope

- 不在本 task 抽取 keyboard shell。
- 不实现跨 cell Tab 导航。
- 不接入 paste、programmatic write 或 anchor detach fallback。
- 不实现新 public type。

## Acceptance Criteria

- [x] 生产消费点中旧 `activeCell.value` 归零。
- [x] text、choice 使用 identity codec 完成 format、parse 和 validate。
- [x] switch 通过 typed candidate 直提交并执行 validate。
- [x] invalid/unparsed draft 不污染 row 领域类型。
- [x] blocked finish 保持 editor 和焦点目标，不产生 change。
- [x] Escape 恢复 initial value。
- [x] snapshot 不包含 active draft，成功提交后包含 typed candidate。
- [x] Task 01 characterization 全部通过。

## Verification Profile

```bash
pnpm exec vitest run src/hooks/use-data-table/use-data-table-editing.test.tsx src/components/data-table/cells/data-table-editable-value-cell.test.tsx src/components/data-table/cells/data-table-editable-choice-cell.test.tsx src/components/data-table/columns/data-table-column-factory.test.tsx
pnpm typecheck
pnpm lint
```

## Execution Recipe

1. 为新 session union、finish result 和 display-row 规则补失败测试。
2. 修改共享类型并一次性迁移 runtime。
3. 让 text、choice editor 读写 `draftValue`。
4. 让 switch 直接调用 typed `commitCandidate()`。
5. 删除旧 `activeCell.value` 生产消费点。
6. 运行 Task 01 与本 task 的全部回归。
7. 完成统一 Review 与父设计状态回写。

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- active session 已一次性迁移为 `draftValue + parseState + candidateValue +
validationErrors`，并在启动时固化当前列的 resolved editable meta；生产消费点不再保留
  `activeCell.value`、`setActiveValue()` 或 `commitValue()`。
- text 与 choice editor 已改为通过 column-bound identity codec 执行 format、parse 和
  validate；只有 valid candidate 会进入 display row，active draft 不进入 snapshot。
- 新增统一 `commitCandidate()` 和 `committed`、`unchanged`、`blocked`、`reverted`、
  `stale-session` 结构化结果；旧 session 事件不会修改当前 session。
- switch 的点击和选中 cell Enter 路径均直接提交 typed candidate，不创建 editing
  session，并补充非法 candidate 被 validator 拦截的测试。
- blocked input 会保留 editor 并恢复输入焦点；现有 Tab 导航仅在 committed 或 unchanged
  后发生。按 task 范围保留了当前内联键盘处理，没有提前抽取 Task 04 keyboard shell。
- 除规格列出的文件外，迁移了 `use-dsl-data-table.test.tsx` 中唯一的旧 runtime API
  消费点，以保持跨页草稿回归测试可编译并继续验证外部契约。

### 阻塞项或未预期的技术债务

- 无阻塞项。
- keyboard lifecycle、Tab DOM 查询和焦点恢复仍分别存在于 input / choice editor；这是
  Task 04 的既定范围，本 task 只消费结构化 finish result。
- hook 的 legacy `updateCell()` 入口仍保留原有空值判断；editor 与 switch 已统一经过
  codec，paste 和 programmatic write 要到 Task 05 才全部收敛到 codec 管线。
- `virtualization-detach` 与 `explicit-confirm-detach` 已进入 finish result 类型，但实际
  anchor detach fallback 仍由 Task 06 实现。

### 后续行动项（Action Items）

- TODO (P0)：Task 04 抽取共享 keyboard shell 与 finish-and-navigate helper，补齐 IME、
  portal 事件边界和失败不导航回归。
- TODO (P0)：Task 05 将 paste、raw programmatic 和 typed programmatic 写入统一接入
  column-bound codec 与 `commitCandidate()`。
- TODO (P1)：Task 06 实现 anchor 生命周期、virtualization detach 的确定性 commit /
  revert，并覆盖 StrictMode 重挂载与 stale cleanup。
