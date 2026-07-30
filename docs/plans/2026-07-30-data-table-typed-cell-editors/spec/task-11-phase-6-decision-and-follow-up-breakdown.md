# Task 11：Phase 6 决策与二次拆分

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 10

**Blocks:** Phase 6 implementation tasks

**Type:** decision

## Goal

用真实使用证据完成 typed matrix paste policy 和 virtualizer pinning 的决策，并把 Phase 6 的独立增强拆成后续实现 task；本 task 不直接把所有增强写进产品代码。

## Files

- Create: `docs/plans/2026-07-30-data-table-typed-cell-editors/reviews/phase-6-decision.md`
- Create after decisions: `docs/plans/2026-07-30-data-table-typed-cell-editors/spec/task-12-*.md`
- Modify status/dependencies only: `docs/plans/2026-07-30-data-table-typed-cell-editors-design.md`
- Reference: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Reference: `src/components/ui/table/virtualization/use-data-table-virtualization.ts`
- Reference: `e2e/data-table-editing-example.smoke.spec.ts`

## Decision A：Typed Matrix Paste

必须用真实 Excel 多行多列样本验证：

- failure/skipped 坐标是否足以定位错误。
- readonly、越界、跨 pinned column 和 textarea 换行。
- audit、批处理、撤销与保存 API 是否允许部分成功。
- 大批量 parse/validate 的性能和错误呈现。

必须在以下 policy 中明确选择：

- `atomic`
- `valid-cells`

无论选择哪一个，后续实现都必须采用 `preparePaste() → PastePlan → applyPaste()`，禁止先写成功 cell 再回滚。

## Decision B：Virtualizer Pinning

独立 spike：

- active row 的 `rangeExtractor` 保留。
- column virtualizer 下 active column pinning。
- popup anchor、row/column 坐标和 workspace overlay 生命周期。
- 对滚动范围、性能和固定列的影响。

只有 row、column 和 overlay 三者都稳定时，才允许用 pinning 替换 V1 detach fallback；否则保留 V1 行为。

## Required Follow-up Tasks

决策完成后至少按独立职责创建：

1. matrix paste prepare/apply 与错误清单。
2. virtualizer pinning（仅 go 决策时创建）。
3. printable key 与 Delete/Backspace 键盘增强。
4. fill handle。
5. server validation error 回写 cell 状态。

不得把上述五项合并成一个 feature task。

## Invariants

- Task 11 不修改生产代码。
- 不预设 `atomic` 或 `valid-cells`。
- spike 代码不得未经 Review 进入生产路径。
- Phase 6 决策不反向阻塞已经完成的 V1 typed single-cell editor。
- 新 task 继续遵守 capability gate、column-bound codec 和 sessionId 契约。

## Acceptance Criteria

- [ ] 决策文档记录真实样本、结果、性能数据和业务约束。
- [ ] matrix paste policy 已由首席架构师确认。
- [ ] pinning 有明确 go/no-go 结论和回滚标准。
- [ ] 所有接受的增强已生成独立 task 文件和依赖拓扑。
- [ ] 父设计只追加实现状态或依赖关系 Update，没有改写原始描述。
- [ ] 没有产品代码或依赖变更混入本 task。

## Verification Profile

```bash
pnpm exec oxfmt --check docs/plans/2026-07-30-data-table-typed-cell-editors/spec docs/plans/2026-07-30-data-table-typed-cell-editors/reviews/phase-6-decision.md
```

对新增 task 的相对链接执行只读检查，并人工核对每个 task 的 Depends On、Blocks 和退出条件。

## Execution Recipe

1. 收集 Excel、业务保存 API、审计和撤销样本。
2. 完成 matrix paste policy 评估。
3. 完成 virtualizer pinning spike，不合入产品路径。
4. 请求首席架构师裁决。
5. 写入 decision review，并创建后续独立 task。
6. 更新本索引拓扑和父设计状态/依赖。
7. 完成统一 Review。
