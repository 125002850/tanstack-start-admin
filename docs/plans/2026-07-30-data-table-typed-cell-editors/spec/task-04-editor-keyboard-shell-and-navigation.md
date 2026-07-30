# Task 04：Keyboard Shell 与导航

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 03

**Blocks:** Task 05

**Type:** interaction

## Goal

建立统一 `DataTableEditorKeyboardShell` 和 `finishEditingAndNavigate()`，让 editor 共享 session guard、IME、Escape、Tab、焦点恢复和 `defaultPrevented` 边界，同时保留各 editor 的领域 keymap。

## Files

- Create: `src/components/ui/table/cells/data-table-editor-keyboard-shell.tsx`
- Create: `src/components/ui/table/cells/data-table-editor-keyboard-shell.test.tsx`
- Create: `src/components/ui/table/core/data-table-editor-navigation.ts`
- Create: `src/components/ui/table/core/data-table-editor-navigation.test.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-value-cell.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-choice-cell.tsx`
- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/ui/table/core/data-table.test.tsx`

## Invariants

- Shell 只执行 keymap 策略，不猜测 numeric、multiline、choice 或 date 领域语义。
- Tab/Shift+Tab 仅在 `committed` 或 `unchanged` 后导航。
- `blocked`、`reverted` 和 `stale-session` 不得被当作成功提交。
- IME composing 期间不提交、不取消、不触发表格快捷键。
- editor 子控件已 `preventDefault()` 的事件不得泄漏到 table hotkeys。
- DOM 查询和 logical coordinate 属于 UI 导航层，不进入纯数据 runtime。

## Keymap Baseline

- `singleLine`：Enter 提交。
- `choice`：Enter 和 Arrow keys 交给 listbox。
- `multiline`、`numeric`、`date`：只建立可扩展 profile，不在本 task 开放对应 editor。
- Escape：取消当前 session。
- Tab / Shift+Tab：完成后移动相邻 editable cell。

## Out of Scope

- 不实现 printable key 覆盖输入。
- 不实现 Delete/Backspace 清空。
- 不实现 numeric step、textarea 换行或 Calendar 导航。
- 不改变 range selection 的复制语义。

## Acceptance Criteria

- [ ] text 与 choice 复用同一 Shell 生命周期。
- [ ] blocked Tab 保持当前 editor 和焦点。
- [ ] committed/unchanged Tab 在 microtask 中聚焦相邻 editable cell。
- [ ] Shift+Tab 反向移动。
- [ ] IME compositionend 前不触发 finish。
- [ ] Portal 子控件消费的 Enter/Escape 不被重复处理。
- [ ] stale session 的延迟键盘事件无副作用。
- [ ] 既有 range selection 键盘回归通过。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/cells/data-table-editor-keyboard-shell.test.tsx src/components/ui/table/core/data-table-editor-navigation.test.tsx src/components/ui/table/cells/data-table-editable-value-cell.test.tsx src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx src/components/ui/table/core/data-table.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先为 finish result 与导航关系、IME 和 `defaultPrevented` 补失败测试。
2. 实现 keyboard shell 和 keymap profile。
3. 实现共享导航 helper。
4. 迁移 text、choice editor，删除重复键盘处理。
5. 验证 Portal 和 table hotkeys 的事件边界。
6. 运行 unit、typecheck、lint 和 browser smoke。
7. 完成统一 Review 与父设计状态回写。
