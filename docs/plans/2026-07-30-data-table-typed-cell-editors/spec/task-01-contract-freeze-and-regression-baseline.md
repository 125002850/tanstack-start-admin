# Task 01：契约冻结与回归基线

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** 首席架构师明确批准父设计

**Blocks:** Task 02

**Type:** test / contract

## Goal

在架构迁移前固定现有 text、choice、switch、editing session、跨页草稿和 cell selection 行为，建立可证明“迁移前后等价”的回归基线。

## Files

- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-value-cell.test.tsx`
- Modify: `src/components/data-table/cells/data-table-editable-choice-cell.test.tsx`
- Modify: `src/components/data-table/columns/data-table-column-factory.test.tsx`
- Modify only if browser coverage is missing: `e2e/data-table-editing-example.smoke.spec.ts`
- Reference: `src/hooks/use-data-table/use-data-table-editing.ts`
- Reference: `src/types/data-table.ts`

## Invariants

- 本 task 不修改生产行为。
- 不添加新 editable type、codec、adapter 或 public API。
- 不把当前实现细节误写成永久约束；基线只固定用户可观察行为和既有公共契约。
- `editing.onChange`、snapshot、`acceptChanges()` 和 `discardChanges()` 的外部结构必须被覆盖。

## Required Characterization

- text：双击、Enter/F2 开始，Enter/Tab/blur 完成，Escape 取消。
- choice：单选、多选、allowEmpty、maxSelected 和 stale popup 事件。
- switch：不进入 active session，直接产生 `selection` change。
- session：旧 session 的 finish、cancel、blur 不影响新 session。
- active value：编辑中只影响当前显示，不进入 snapshot。
- scope：跨页草稿、refetch 合并和并发 `acceptChanges()` 保持现状。
- cell interaction：selected、edit-ready、editing 三态互斥。

## Out of Scope

- 不增加 draft / parseState / candidate 新模型。
- 不修改 editor DOM 或视觉样式。
- 不为 Phase 6 增加 matrix paste。

## Acceptance Criteria

- [x] 父设计状态已由首席架构师明确批准。
- [x] 上述 characterization 全部由自动化测试覆盖。
- [x] 新增测试在未修改生产代码的情况下通过。
- [x] 回归基线没有依赖不稳定的计时或实现私有 state。
- [x] 测试能够在 Task 03 后继续用于证明 legacy 行为等价。

## Verification Profile

```bash
pnpm exec vitest run src/hooks/use-data-table/use-data-table-editing.test.tsx src/components/data-table/cells/data-table-editable-value-cell.test.tsx src/components/data-table/cells/data-table-editable-choice-cell.test.tsx src/components/data-table/columns/data-table-column-factory.test.tsx
pnpm typecheck
pnpm lint
```

如果修改浏览器 smoke，再执行：

```bash
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先运行目标测试并记录基线。
2. 对照父设计第 4、5、12、17 节补齐缺失的 legacy 行为断言。
3. 不修改生产代码，重新运行目标测试。
4. 记录可能阻塞迁移的隐式契约，但不得在本 task 顺手重构。
5. 完成统一 Review 与父设计状态回写。

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 父设计已由首席架构师明确批准，并将状态更新为 `APPROVED`。
- 目标测试基线从 38 个测试扩展为 39 个测试；补齐 text 的 Enter / F2 启动、Escape
  取消、Tab / blur 完成，switch 不创建 active session，以及跨 cell 三态互斥断言。
- 强化 stale session characterization，确认旧 session 的 cancel / finish / blur 不会影响
  新 session，也不会产生额外 `onChange`。
- 固定 `editing.onChange` 的完整 event / snapshot 外部结构，以及 text 默认 editor metadata。
- 未修改生产代码；现有浏览器 smoke 已保留，本 task 未发现必须新增的浏览器覆盖。

### 阻塞项或未预期的技术债务

- 无阻塞项。
- 当前 legacy `finishEditing()` 返回 `void`，Tab 导航只能假定完成成功；这是 Task 03–04
  已计划迁移的隐式契约，本 task 仅通过行为测试冻结，不在 Phase 0 重构。
- editor 卸载仍会触发携带旧 `sessionId` 的 blur cleanup；当前 runtime 依靠 stale-session
  guard 保证无副作用，Task 03 与 Task 06 迁移时必须继续满足该回归基线。
- 补充执行全仓 `pnpm format:check` 时发现 41 个与本 task 无关的既有格式问题；本 task
  修改的 7 个文件已通过定向 `oxfmt --check`。

### 后续行动项（Action Items）

- TODO (P0)：Task 02 引入 adapter registry、codec 和 capability gate，并保持本 task
  characterization 全部通过。
- TODO (P0)：Task 03–04 将 `finishEditing()` 迁移为结构化结果和统一键盘 shell 后，继续以
  本 task 证明 text、choice、switch 与三态交互向后兼容。
- TODO (P2)：在独立 chore 中清理全仓既有格式基线，不与类型化 editor 功能代码混合。
