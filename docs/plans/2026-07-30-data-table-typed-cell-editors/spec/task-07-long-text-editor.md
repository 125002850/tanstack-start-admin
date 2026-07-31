# Task 07：Long Text Editor

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** Task 06

**Blocks:** Task 08

**Type:** feature

## Goal

以 `longText + edit.control='textarea'` 验证 typed session 基础管线，交付非模态 textarea popup、文本 codec、字符限制、键盘和虚拟化生命周期，并在全部退出条件通过后开放 `longText` public gate。

## Files

- Create: `src/components/data-table/cells/data-table-editable-textarea-cell.tsx`
- Create: `src/components/data-table/cells/data-table-editable-textarea-cell.test.tsx`
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

- [x] `longText` 字段和值约束在编译期生效。
- [x] `minLength`、`maxLength`、`allowEmpty` 和 `emptyValue` 使用同一 codec 校验。
- [x] 字符计数可见，错误使用 `aria-invalid` 和 `aria-describedby`。
- [x] popup 内点击和滚动不触发表格 selection。
- [x] Ctrl/Cmd+Enter、Tab、Shift+Tab、Escape 和 IME 行为通过。
- [x] valid/invalid/explicit popup 的虚拟化卸载行为通过。
- [x] codec、editor、runtime、类型测试和 browser smoke 全部通过后才启用 `longText` public gate。

## Verification Profile

```bash
pnpm exec vitest run src/components/data-table/cells/data-table-editable-textarea-cell.test.tsx src/components/data-table/columns/data-table-edit-codecs.test.ts src/components/data-table/columns/data-table-edit-adapters.test.ts src/components/data-table/columns/data-table-column-factory.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
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

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 新增 column-bound longText codec：不 trim，parse 时把 CRLF / CR 统一为 LF，
  `allowEmpty`、`emptyValue`、`minLength`、`maxLength` 由同一实例解析与校验。
- public DSL 新增 `longText + edit.control='textarea'` overload；只接受 string /
  nullable string 字段，非 nullable string 的 `emptyValue: null` 和 number 字段在编译期
  被拒绝。
- 新增非模态 `DataTableEditableTextareaCell`，复用现有 Popover、InputGroupTextarea、
  overlay container、keyboard shell 和 anchor lifecycle；display cell 保持单行截断。
- popup 提供字符计数、提交说明、显式确认/取消、`aria-invalid` 和
  `aria-describedby` 错误关联；maxLength 同时限制用户输入并由 codec 保护 programmatic
  write。
- Enter 保留换行，Ctrl/Cmd+Enter、Tab/Shift+Tab、Escape 和 IME 边界复用并扩展共享
  keyboard shell 测试；blocked submit 保持焦点和 session。
- 示例页增加 longText 覆盖；浏览器 smoke 验证真实 portal、CRLF 提交归一化、确认提交和
  500 行虚拟卸载时 explicit-confirm revert。
- 按 gate 要求，在 codec、adapter、editor、runtime、类型与 E2E 全部通过后才把
  `longText` 注册进 `enabledEditableTypeAdapters`。

### 阻塞项或未预期的技术债务

- 无新增阻塞项。
- 没有抽取通用 popup hook；date editor 尚未证明与 textarea 的 focus/open state
  生命周期完全相同，继续遵守本 task 的 out-of-scope。
- HTML `maxLength` 与计数沿用浏览器 UTF-16 code unit 语义；若产品要求按 grapheme
  cluster 计数，需要独立定义 Unicode 字符限制契约。
- Task 06 已记录的两个无关全仓 unit 基线失败仍存在；本 task 的 5 个目标文件共 55 个
  测试、typecheck、lint、build 和浏览器 smoke 均通过。

### 后续行动项（Action Items）

- TODO (P0)：Task 08 Numeric 家族继续复用 column-bound codec、programmatic write、
  keyboard shell 和 virtualization fallback，不在 input 内复制 parser。
- TODO (P1)：Task 09 date popup 完成后再比较 textarea/date 生命周期，决定是否值得抽取
  最小共享 popup lifecycle。
- TODO (P2)：如业务提出 emoji 按“一个可见字符”计数，先定义 grapheme contract，再调整
  codec、计数和 maxLength 输入策略。
