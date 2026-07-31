# Task 13：Printable Key 与 Delete / Backspace

**Parent Decision:** [Phase 6 决策](../reviews/phase-6-decision.md)

**Status:** COMPLETE

**Depends On:** Task 12

**Blocks:** None

**Type:** interaction

## Goal

补齐 spreadsheet 风格键盘入口：选中 editable cell 后输入 printable key 直接以该字符启动
编辑；Delete / Backspace 通过 Task 12 的 atomic plan 清空单 cell 或 range，并保持 IME、
readonly 和 nullable 契约。

## Files

- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/ui/table/core/data-table.test.tsx`
- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `e2e/data-table-cell-range-selection.smoke.spec.ts`

## Invariants

- IME composition、Ctrl/Meta/Alt shortcut、功能键和导航键不作为 printable key。
- printable key 启动 session 时只写 table-level draft，不直接提交业务 snapshot。
- Delete / Backspace 对 range 使用 atomic prepare/apply；任一不可清空 cell 令整次操作失败。
- non-nullable、readonly、缺失 codec 和 active explicit-confirm session fail closed。
- 不拦截 input、textarea、combobox 或 popup 内原生键盘行为。

## Acceptance Criteria

- [x] printable ASCII、中文 IME、全角输入和 modifier 组合通过。
- [x] text/numeric/date/dateTime 的首字符 draft 使用各自 codec 验证。
- [x] Delete / Backspace 对单 cell 与 range 的 nullable / required 规则通过。
- [x] readonly 或 required failure 时 atomic 零写入并定位失败 cell。
- [x] active popup、range selection、RTL 方向键与虚拟滚动无回归。
- [x] 浏览器 clipboard / keyboard smoke 通过。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/core/data-table.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 冻结 printable key、IME 和 Delete / Backspace 失败测试。
2. 实现 selection-level keyboard classifier。
3. printable key 通过 session draft 启动；删除通过 atomic plan。
4. 接入错误反馈与 focus 保持。
5. 完成浏览器回归和 Review。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- selection-level keyboard classifier 已支持 ASCII、中文与全角 printable key，并排除
  IME composition、Ctrl / Meta / Alt 组合键、功能键和多 cell range。
- text、numeric、date、dateTime 通过 table-level session draft 接收首字符；首字符不直接
  写入业务 snapshot，后续仍由各列 codec 验证。
- Delete / Backspace 统一生成空值 matrix，并复用 Task 12 的异步 prepare、revision
  校验与 `applyBatch()` atomic transaction；成功时只触发一次 `delete` change event。
- required、readonly、缺失 codec 或 active session 失败时保持零写入，并用 source /
  target 坐标定位首个失败 cell；成功后保留原 focus 与 selection。
- 原 task 预估修改 editing runtime 与其测试；实际直接复用 Task 12 已完成的 batch
  runtime，因此未重复修改 runtime，回归集中在 core selection tests。

### 阻塞项或未预期的技术债务

- 无剩余阻塞项。
- choice 与 switch 不接受无歧义的单字符 draft，因此 printable-to-edit 明确限制在
  text、longText、numeric、date 与 dateTime editor；其原生键盘入口保持不变。
- 浏览器 smoke 覆盖了 printable ASCII、required atomic rollback 与 nullable
  Backspace；中文 IME、全角输入和 modifier 组合由可控的 unit event contract 覆盖。

### 后续行动项（Action Items）

- `TODO (P1)`：若未来 choice editor 需要首字母检索，应在 popup 自身实现 typeahead，
  不复用 scalar draft 入口。
- `TODO (P2)`：补充 Windows 浏览器上的 Delete / Backspace 键位互操作证据。

### 验证结果

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 规格目标 Vitest：2 files、125 tests 全部通过。
- 扩展 typed editor / matrix 回归：5 files、126 tests 全部通过。
- `pnpm exec oxfmt --check ...`：4 个 Task 13 文件全部通过。
- `git diff --check`：通过。
- `data-table-cell-range-selection.smoke.spec.ts`：7 / 7 通过。
