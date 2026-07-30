# Task 03：Editing Session 与 Legacy 迁移

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 02

**Blocks:** Task 04

**Type:** runtime

## Goal

把 editing runtime 一次性迁移为 `draftValue + parseState + candidateValue + validationErrors`，建立统一 `commitCandidate()` 和结构化 finish result，并让 text、choice、switch 通过新管线保持原有行为。

## Files

- Modify: `src/types/data-table.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-value-cell.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-value-cell.test.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-choice-cell.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx`
- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`

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

- [ ] 生产消费点中旧 `activeCell.value` 归零。
- [ ] text、choice 使用 identity codec 完成 format、parse 和 validate。
- [ ] switch 通过 typed candidate 直提交并执行 validate。
- [ ] invalid/unparsed draft 不污染 row 领域类型。
- [ ] blocked finish 保持 editor 和焦点目标，不产生 change。
- [ ] Escape 恢复 initial value。
- [ ] snapshot 不包含 active draft，成功提交后包含 typed candidate。
- [ ] Task 01 characterization 全部通过。

## Verification Profile

```bash
pnpm exec vitest run src/hooks/use-data-table/use-data-table-editing.test.tsx src/components/ui/table/cells/data-table-editable-value-cell.test.tsx src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx src/components/ui/table/columns/data-table-column-factory.test.tsx
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
