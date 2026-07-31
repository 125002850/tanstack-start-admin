# Task 04：Keyboard Shell 与导航

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

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

- [x] text 与 choice 复用同一 Shell 生命周期。
- [x] blocked Tab 保持当前 editor 和焦点。
- [x] committed/unchanged Tab 在 microtask 中聚焦相邻 editable cell。
- [x] Shift+Tab 反向移动。
- [x] IME compositionend 前不触发 finish。
- [x] Portal 子控件消费的 Enter/Escape 不被重复处理。
- [x] stale session 的延迟键盘事件无副作用。
- [x] 既有 range selection 键盘回归通过。

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

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 新增 `DataTableEditorKeyboardShell`，统一 session guard、卸载 blur lifecycle、IME guard、
  Escape、Enter、Tab / Shift+Tab 和 `defaultPrevented` 边界；预建 `singleLine`、
  `choice`、`multiline`、`numeric`、`date` 显式 profile。
- 新增 `finishEditingAndNavigate()`，把 editable cell DOM 查询和 microtask 聚焦收敛到 UI
  导航层，并严格限定只有 committed / unchanged 才执行前后导航。
- text 与 choice 已删除重复 lifecycle 和键盘代码，复用同一个 Shell；原有
  `data-slot` 保留，未改变 editor 样式和 ready-state CSS 契约。
- choice Enter 按设计改为交给 listbox；一个旧 remote multiple 测试从 Enter 完成改为
  Tab 完成，选择与提交结果保持不变。
- DataTable cell hotkey 入口新增 composing 和 `defaultPrevented` guard；单元测试通过真实
  React portal 验证子控件消费的 Escape 不会被 Shell 重复处理。
- 规定的 5 个 Vitest 文件共 107 个测试通过，typecheck、lint、生产构建和
  `data-table-editing-example` 的 2 个 `@workspace-v2` smoke 均通过。

### 阻塞项或未预期的技术债务

- 无阻塞项。
- 当前导航 helper 只处理已挂载 DOM 中的相邻 editable cell，不做 wrap、virtual scroll
  或 logical coordinate 恢复；虚拟化 anchor 生命周期由 Task 06 处理。
- Shell 卸载仍以 blur 结束 session；区分普通卸载、virtualization detach 和
  explicit-confirm detach 的策略尚未接入，这是 Task 06 的既定范围。
- multiline、numeric 和 date profile 目前只有 keymap policy，不开放对应 public editor。

### 后续行动项（Action Items）

- TODO (P0)：Task 05 让 paste 与 programmatic 写入复用 column-bound codec 和统一提交
  事务，不把解析逻辑放入 keyboard shell。
- TODO (P0)：Task 06 为 Shell 接入 anchor 注册和 detach reason，覆盖 virtual scroll、
  StrictMode 重挂载和旧 cleanup。
- TODO (P1)：各 typed editor 开放时分别补 multiline / numeric / date profile 的领域
  keymap 测试，Shell 继续只负责通用策略。
