# Task 05：类型化写入入口

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 04

**Blocks:** Task 06

**Type:** runtime

## Goal

把 editor finish、单 cell paste、raw programmatic write 和 typed programmatic write 接入同一份 column-bound codec 与 `commitCandidate()`，消除绕过 parse/validate 的写入路径。

## Files

- Modify: `src/types/data-table.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/ui/table/core/data-table.test.tsx`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.test.ts`

## Invariants

- raw 输入执行 `parse → validate → commitCandidate`。
- typed candidate 可以跳过 parse，但不能跳过 validate。
- 所有入口从 `columnDef.meta.editableCell.codec` 读取同一 bound codec。
- 缺失 adapter/codec 时 fail closed，不提交 change。
- editor paste 与 selection paste 的职责边界明确：active textarea 内换行属于 editor；selection matrix 不在本 task 开放。
- 单次提交只产生一次 change event。

## Required Public Shape

程序化写入必须显式区分调用方意图：

```ts
type DataTableProgrammaticEditInput<TValue> =
  | { kind: 'raw-draft'; value: unknown }
  | { kind: 'typed-candidate'; value: TValue };
```

不提供绕过 validate 的 trusted/unsafe 入口。

## Out of Scope

- 不实现 matrix paste。
- 不决定 `atomic` 与 `valid-cells`。
- 不实现 fill handle。
- 不扩展服务端筛选 DSL。

## Acceptance Criteria

- [ ] editor、single-cell paste、raw programmatic 对相同 raw input 得到相同结果。
- [ ] typed programmatic 对非法 candidate 返回 blocked/failure，不产生 change。
- [ ] readonly、不可编辑或缺失 codec 的目标保持不变。
- [ ] 单 cell paste 不把 numeric-looking string 自动写入 legacy text 以外的未开放 type。
- [ ] matrix selection paste 在 Phase 6 前明确拒绝或保持关闭。
- [ ] snapshot 和 `onChange` 只包含成功提交的领域值。

## Verification Profile

```bash
pnpm exec vitest run src/hooks/use-data-table/use-data-table-editing.test.tsx src/components/ui/table/core/data-table.test.tsx src/components/ui/table/columns/data-table-edit-codecs.test.ts
pnpm typecheck
pnpm lint
```

## Execution Recipe

1. 为四条入口的等价性和 fail-closed 行为补失败测试。
2. 在 runtime 中收敛 raw/typed 写入入口。
3. 将单 cell paste 接入当前列 bound codec。
4. 明确阻止 matrix paste 提前开放。
5. 验证 change event、snapshot 和 readonly 行为。
6. 完成统一 Review 与父设计状态回写。
