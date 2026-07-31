# Task 11：Phase 6 决策与二次拆分

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** Task 10

**Blocks:** Phase 6 implementation tasks

**Type:** decision

## Goal

用真实使用证据完成 typed matrix paste policy 和 virtualizer pinning 的决策，并把 Phase 6 的独立增强拆成后续实现 task；本 task 不直接把所有增强写进产品代码。

## Files

- Create: `docs/plans/2026-07-30-data-table-typed-cell-editors/reviews/phase-6-decision.md`
- Create after decisions: `docs/plans/2026-07-30-data-table-typed-cell-editors/spec/task-12-*.md`
- Modify status/dependencies only: `docs/plans/2026-07-30-data-table-typed-cell-editors-design.md`
- Reference: `src/components/data-table/core/use-data-table-cell-selection.ts`
- Reference: `src/components/data-table/virtualization/use-data-table-virtualization.ts`
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

- [x] 决策文档记录样本、结果、性能数据和业务约束；真实采样由首席架构师批准的合成
      Excel-compatible fixture 替代，差异见 Review。
- [x] matrix paste policy 已由首席架构师确认。
- [x] pinning 有明确 go/no-go 结论和回滚标准。
- [x] 所有接受的增强已生成独立 task 文件和依赖拓扑。
- [x] 父设计只追加实现状态或依赖关系 Update，没有改写原始描述。
- [x] 没有产品代码或依赖变更混入本 task。

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

## Decision Update (2026-07-31)

- 首席架构师确认 typed matrix paste 采用 `atomic`。
- 首席架构师确认 virtualizer pinning 为 `no-go`，保留 V1 detach fallback，不创建
  pinning 实现 task。
- codec 性能 spike 已完成：10,000 cells 为 142.44ms，100,000 cells 为
  1,317.25ms；临时 spike 文件已删除。
- 已拆分 Task 12 atomic matrix paste、Task 13 printable/delete、Task 14 fill handle
  和 Task 15 server validation error。
- 原始 Excel sample 是 `<从 Excel 原样粘贴>` 模板占位符；首席架构师随后批准由代理
  模拟。已新增带 provenance 和限制声明的 Excel-compatible E01–E03 fixture。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 完成 single-cell paste、editing transaction、virtualizer 和 overlay 当前能力审计。
- 完成 10k / 100k column-bound codec prepare 性能 spike，临时代码未进入生产路径。
- matrix paste 确认为 `atomic`；virtualizer pinning 确认为 `no-go`。
- 创建 Task 12–15 并更新依赖拓扑，没有创建被否决的 pinning task。
- 原任务要求真实 Excel clipboard sample；首席架构师明确批准改用合成
  Excel-compatible fixture。fixture 保留 Tab、CRLF、quoted multiline 和 escaped
  quote，但不宣称真实 Excel 跨平台互操作性。

### 阻塞项或未预期的技术债务

- Task 11 无剩余阻塞项。
- 当前 range selection 明确排除 pinned column；Task 12 必须保持该边界并对跨 pinned
  target fail closed。
- 10k 级同步 prepare 已有可感知阻塞风险，需要在 Task 12 落实上限、分块或取消。
- 未采集 Windows / macOS Excel 的真实 clipboard 差异，属于非阻塞兼容性证据缺口。

### 后续行动项（Action Items）

- `TODO (P0)`：Task 12 将合成 fixture 固化为 parser / atomic plan contract tests。
- `TODO (P0)`：Task 12 保证任一 failure 时 draft、session、selection 和 snapshot
  零写入。
- `TODO (P1)`：Task 12 增加浏览器 ClipboardEvent round-trip、10k 上限与取消测试。
- `TODO (P2)`：补采 Windows / macOS Excel 样本；若与 fixture 不同，新增兼容 case。
