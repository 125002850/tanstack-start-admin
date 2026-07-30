# Task 07：Long Text Editor

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 06

**Blocks:** Task 08

**Type:** feature

## Goal

以 `longText + edit.control='textarea'` 验证 typed session 基础管线，交付非模态 textarea popup、文本 codec、字符限制、键盘和虚拟化生命周期，并在全部退出条件通过后开放 `longText` public gate。

## Files

- Create: `src/components/ui/table/cells/data-table-editable-textarea-cell.tsx`
- Create: `src/components/ui/table/cells/data-table-editable-textarea-cell.test.tsx`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.test.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/elements/components/data-table-editable-choice-contract-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

## Invariants

- 继续使用 `columnDsl.editableField()`，不新增 textarea 专属 column API。
- popup 复用现有 `Popover` 与 `Textarea` / `InputGroupTextarea`。
- `InputGroup` 内只使用 `InputGroupTextarea`，不嵌入 raw `Textarea`。
- portal container 和焦点恢复复用仓库 overlay 契约。
- active draft 保存在 table store。
- 不默认 trim；CRLF 在提交时统一为 LF。
- 非 nullable string 字段不能配置 `emptyValue: null`。
- display cell 保持固定行高和截断。

## Keyboard Contract

- Enter：插入换行。
- Ctrl/Cmd + Enter：提交。
- Tab / Shift+Tab：成功提交后导航。
- Escape：取消整个 session。
- textarea 默认不插入 Tab 字符。

## Out of Scope

- 不实现 Markdown、富文本或附件。
- 不让 cell 因内容扩高。
- 不抽取未经 date editor 验证的通用 popup abstraction。

## Acceptance Criteria

- [ ] `longText` 字段和值约束在编译期生效。
- [ ] `minLength`、`maxLength`、`allowEmpty` 和 `emptyValue` 使用同一 codec 校验。
- [ ] 字符计数可见，错误使用 `aria-invalid` 和 `aria-describedby`。
- [ ] popup 内点击和滚动不触发表格 selection。
- [ ] Ctrl/Cmd+Enter、Tab、Shift+Tab、Escape 和 IME 行为通过。
- [ ] valid/invalid/explicit popup 的虚拟化卸载行为通过。
- [ ] codec、editor、runtime、类型测试和 browser smoke 全部通过后才启用 `longText` public gate。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/cells/data-table-editable-textarea-cell.test.tsx src/components/ui/table/columns/data-table-edit-codecs.test.ts src/components/ui/table/columns/data-table-edit-adapters.test.ts src/components/ui/table/columns/data-table-column-factory.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先补 longText codec、字段类型和 keyboard 失败测试。
2. 实现 longText bound codec 和 adapter，但保持 public gate 关闭。
3. 实现 textarea popup，并接入 keyboard shell、overlay container 和 anchor lifecycle。
4. 扩展示例页和 browser smoke。
5. 完成全部退出验证后，单独打开 `longText` gate。
6. 完成统一 Review 与父设计状态回写。
