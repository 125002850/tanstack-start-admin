# Task 02：Adapter Registry、Codec 与 DSL Gate

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 01

**Blocks:** Task 03

**Type:** architecture

## Goal

建立 column-bound codec、`EditableTypeAdapterRegistry` 和 public capability gate，把 `editableField()` 从分散分支迁移到 registry 分发，同时保持当前 public editable type 和行为不变。

## Files

- Create: `src/components/ui/table/columns/data-table-edit-codecs.ts`
- Create: `src/components/ui/table/columns/data-table-edit-codecs.test.ts`
- Create: `src/components/ui/table/columns/data-table-edit-adapters.ts`
- Create: `src/components/ui/table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`

## Invariants

- adapter 以 column `type` 为 key，保存 factory，不保存跨列共享的 codec 实例。
- `columnDef.meta.editableCell` 持有已解析、绑定具体列的 codec 和 editor meta。
- planned type 的内部 options/overload 骨架可以建立，但 public DSL 只能暴露已经可执行的 legacy type。
- 缺失 adapter 或 codec 时 fail closed，禁止回退成 text editor。
- builder 只做配置合并、registry 查找和 meta 写入，不堆叠每个 type 的 editor 分支。
- 不改变展示 type registry 和服务端筛选 DSL。

## Required Contracts

- `DataTableEditParseResult<TValue>`
- `DataTableEditCodec<TData, TValue>`
- `DataTableEditableTypeAdapter<TData, ...>`
- `DataTableResolvedEditableCell<TData, TValue>`
- `PlannedEditableType`
- 从 enabled adapter keys 推导的 `SupportedEditableType`
- legacy text / choice identity codec
- switch typed candidate adapter

## Out of Scope

- 不迁移 active session 数据结构。
- 不实现 numeric、date、dateTime 或 textarea UI。
- 不公开 planned-but-disabled type。
- 不实现 paste 或 programmatic write。

## Acceptance Criteria

- [ ] 同一 type 的不同列产生独立 bound codec。
- [ ] codec 使用合并后的列级配置，配置不会跨列污染。
- [ ] text、enum、select、remoteSelect 和 switch 的现有 DSL 编译结果保持兼容。
- [ ] planned-but-disabled type 在 public `editableField()` 调用处产生 TypeScript 错误。
- [ ] 缺失 adapter/codec 的列不产生可编辑 meta。
- [ ] `data-table-column-builders.tsx` 不再通过平行的 type/editor 条件链分发 legacy editor。
- [ ] 没有新增依赖。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/columns/data-table-edit-codecs.test.ts src/components/ui/table/columns/data-table-edit-adapters.test.ts src/components/ui/table/columns/data-table-column-factory.test.tsx
pnpm typecheck
pnpm lint
```

## Execution Recipe

1. 先补 codec、adapter 和 capability gate 的失败测试。
2. 建立纯 codec 类型和 legacy identity factory。
3. 建立 registry，并把现有 editor meta 迁移为 resolved editable-cell meta。
4. 修改 builder 使用 registry 分发。
5. 加入 planned type 内部骨架和 public gate 类型测试。
6. 运行本 task 验证，不开始 session 迁移。
7. 完成统一 Review 与父设计状态回写。
