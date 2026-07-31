# Task 05：类型化写入入口

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

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

- [x] editor、single-cell paste、raw programmatic 对相同 raw input 得到相同结果。
- [x] typed programmatic 对非法 candidate 返回 blocked/failure，不产生 change。
- [x] readonly、不可编辑或缺失 codec 的目标保持不变。
- [x] 单 cell paste 不把 numeric-looking string 自动写入 legacy text 以外的未开放 type。
- [x] matrix selection paste 在 Phase 6 前明确拒绝或保持关闭。
- [x] snapshot 和 `onChange` 只包含成功提交的领域值。

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

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 新增 public `DataTableProgrammaticEditInput<TValue>` discriminated union 和
  `editing.writeCell()`；raw-draft 必经 parse，typed-candidate 跳过 parse 但不能绕过
  validate。
- runtime 新增 `commitInput()`，single-cell paste 与 programmatic write 均从目标列
  `editableCell.codec` 读取同一个 bound codec，再汇入 `commitCandidate()`。
- 原内部 `updateCell()` 绕过入口已移除，替换为只由 validated commit path 调用的原子
  apply transaction；一次成功写入只发出一次 change event。
- DataTable selection paste 只在单一 selected cell 且 clipboard 不含 tab / newline 时
  执行；readonly、multi-cell range 和 matrix-shaped clipboard 被消费但不修改数据。
- active input / textarea 等 editable control 的 paste 不由 selection handler 接管，保留
  editor 自身职责边界。
- 增加 numeric-looking legacy text 保持 string、invalid typed candidate、readonly、
  missing adapter / codec、matrix closed 和 snapshot / onChange 测试；规定的 3 个测试文件
  共 105 个测试通过。

### 阻塞项或未预期的技术债务

- 无阻塞项。
- matrix paste 当前采用 fail-closed：阻止默认行为且不写入，也不展示逐 cell 错误；具体
  atomic / valid-cells policy 和错误呈现仍由 Task 11 决策。
- public programmatic target 以 `rowId + field` 定位，当前 editable DSL 的 column id 与
  accessor field 一致；若未来允许同一 field 的多套 editable column 配置，需要先扩展
  显式 column identity，不能回退到按 type 猜 codec。

### 后续行动项（Action Items）

- TODO (P0)：Task 06 完成 session-aware anchor lifecycle 和 virtualization detach
  fallback，保证统一写入事务在卸载路径仍只执行一次。
- TODO (P1)：Task 07–10 为各新 codec 复用本 task 的 paste / raw / typed programmatic
  契约测试，不在 editor 内复制 parser。
- TODO (P1)：Task 11 根据真实 Excel 样本决定 matrix paste policy 和失败坐标反馈。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- typed write、active session 与 atomic batch preflight 的用户可见失败提示已统一消费
  DataTable 中文消息目录，覆盖行/列不可用、只读、codec 缺失、stale plan、重复目标和
  active edit 冲突。
- 未改变 commit / revert 状态、revision、单次 change event 或 `string[]` 返回结构。

### 验证结果

- editing runtime 所在定向回归包含在 9 个文件、117 个测试中并通过；typecheck、lint
  与两组 Playwright smoke 同时通过。

### 阻塞项或未预期的技术债务

- 无新增阻塞；运行时仍可能透传后端或调用方提供的任意错误文本，该文本必须由来源系统
  负责 locale 语义。

### 后续行动项（Action Items）

- `TODO (P1)`：后续 I18N 设计为 runtime failure 增加稳定错误码，避免 UI 依赖中文或
  英文字符串分支。
