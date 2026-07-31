# Phase 6：Matrix Paste 与 Virtualizer Pinning 决策

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Decision Date:** 2026-07-31

**Status:** COMPLETE — 首席架构师已裁决并批准合成 Excel-compatible fixture

## 决策摘要

| 事项                | 决策         | 裁决人     | 结论                                                          |
| ------------------- | ------------ | ---------- | ------------------------------------------------------------- |
| Typed Matrix Paste  | `atomic`     | 首席架构师 | 完整 prepare 成功后才允许一次性 apply；任何失败都不得部分写入 |
| Virtualizer Pinning | `no-go`      | 首席架构师 | 保留 V1 detach fallback，不创建 pinning 实现 task             |
| Clipboard 样本验收  | 合成 fixture | 首席架构师 | 使用有明确 provenance 的 Excel-compatible 样本解除 Task 11 门 |

首席架构师在 2026-07-31 明确回复：

```text
policy: atomic; pinning: no-go; Excel sample:
  <从 Excel 原样粘贴>
```

其中 `<从 Excel 原样粘贴>` 是占位文本，未被登记为真实 Excel clipboard 样本。首席
架构师随后明确回复“这你可以模拟一个吗”，批准使用合成 Excel-compatible fixture
替代本次真实采样。该差异作为显式架构豁免记录，不宣称已完成真实 Excel 互操作验证。

## Decision A：Typed Matrix Paste

### 当前能力审计

- `use-data-table-cell-selection.ts` 只允许单 cell paste；选区不是单 cell 时直接返回，
  clipboard 文本含 Tab、CR 或 LF 时同样直接拒绝。
- single-cell paste 已通过目标列的 column-bound codec 执行 parse、validate 和
  commit；matrix paste 必须复用该边界，不能新增第二套类型转换。
- 当前 `applyCellUpdate()` 每次只生成一个 change 并立即触发 `onChange`，不存在
  matrix transaction、`PastePlan`、批量 apply 或失败坐标模型。
- `acceptChanges()` / `discardChanges()` 能管理 table draft，但没有通用 undo / redo
  transaction，也没有 matrix paste 级审计记录。
- 员工管理页实际使用 `Promise.allSettled()` 保存多个字段，并对失败字段逐项回滚；
  这证明个别业务允许部分成功，但不能证明所有 DataTable 保存 API、审计与撤销语义
  都允许 `valid-cells`。
- 固定列当前仍属于可见列索引；readonly、越界、跨 pinned column 和隐藏列的目标
  解析必须在 prepare 阶段完成，不能在 apply 中边走边猜。

### 合成 Excel-compatible 样本矩阵

fixture：
[phase-6-synthetic-excel-clipboard.json](fixtures/phase-6-synthetic-excel-clipboard.json)。
坐标统一使用从 0 开始的 source row / column。

| Sample | 内容                                               | 结果                                                        |
| ------ | -------------------------------------------------- | ----------------------------------------------------------- |
| E01    | 3×5，含数值、日期、非法 typed value 与空值         | shape 保持；两处 typed failure；atomic plan invalid、零写入 |
| E02    | 2×3，含 CRLF、quoted multiline、escaped quote、Tab | 解析为 2×3；单元格内换行归一化为 LF；plan ready             |
| E03    | 2×3 source + readonly / 越界 / pinned target       | 三种 target 均 invalid；分别报告原因且零写入                |

E03 的 pinned boundary 结论沿用当前选择契约：pinned column 不进入 selectable
`rangeIndex`，matrix paste 不扩大该交互面；source 投影触及 pinned column 时 fail
closed。Task 12 不得借 matrix paste 绕过既有 pinned-cell selection 边界。

fixture 明确保留 `\t`、`\r\n`、双引号转义和 quoted multiline 语义，并记录生成来源与
限制。它不是 Microsoft Excel 进程采样；跨操作系统和 Excel 版本的真实互操作验证保留为
后续 P2 证据，不作为本次 Task 11 的阻塞项。

### 性能 spike

2026-07-31 使用当前 column-bound text、decimal、date 与 instant dateTime codec
执行仅 prepare、不 apply 的临时 benchmark；临时测试在记录结果后已删除，没有进入
生产路径。

| Cells   | Valid  | Invalid | Duration   |
| ------- | ------ | ------- | ---------- |
| 10,000  | 9,971  | 29      | 142.44ms   |
| 100,000 | 99,708 | 292     | 1,317.25ms |

结论：

- 10k 级同步 parse / validate 已足以形成可感知主线程阻塞。
- `preparePaste()` 必须支持上限、分块或可取消执行，并在 apply 前形成完整错误清单。
- 性能结果不改变 atomic policy；它要求优化 prepare，而不是允许先写成功 cell。

### Policy：atomic

首席架构师确认采用 `atomic`。后续实现必须遵守：

1. `preparePaste()` 读取 clipboard、选区、row/column 可用性与 column-bound codec，
   生成不可变 `PastePlan`。
2. `PastePlan` 完整记录 source/target shape、operation、failure 与 skipped 坐标。
3. 任一 parse、validate、readonly、越界或字段不可编辑失败都会令 plan
   `status: 'invalid'`。
4. `applyPaste()` 只接受仍匹配当前 table revision 的 `ready` plan，并以单一
   transaction 更新 draft。
5. apply 后只发出一个包含全部 changes 的 `onChange`；不得逐 cell 通知，也不得先写
   后回滚。

## Decision B：Virtualizer Pinning

### Row spike

TanStack Virtual `rangeExtractor` 可以把 active row index 合并进 viewport range。
例如 active row `0`、viewport `988–997` 时，离散索引
`[0, 988, …, 997]` 仍可使用当前 absolute `translateY` 定位，row 总高度不会因此
丢失。

row 单独可行，但不能满足 task 的 row、column、overlay 三方退出条件。

### Column spike

当前 center column virtual window 只有：

- `virtualPaddingLeft`
- 连续 `items`
- `virtualPaddingRight`

它不支持离散 segment。以 40 列、每列 150px、active column `2`、viewport
`18–27` 为例，把 active index 合入 extractor 后：

| 指标                   | 结果    |
| ---------------------- | ------- |
| expected track         | 6,000px |
| composed current track | 3,750px |
| missing internal gap   | 2,250px |

缺失的 `3–17` 内部 gap 无 spacer 表达，会破坏 header/body 对齐、横向滚动范围和固定列
边界。单纯把 active column 加入现有 `rangeExtractor` 不成立。

### Overlay spike

- editor anchor lifecycle 以 DOM detach 触发 V1 commit/revert。
- row/column pinning 会让已滚出 viewport 的 anchor 保持 connected，从而绕过 detach
  fallback。
- 当前 `PopoverContent` 没有 detached-hide / reference-hidden policy，也没有对
  offscreen pinned anchor 的统一关闭或重定位规则。
- 因此 popup 可能继续绑定到不可见 anchor，焦点和 workspace overlay 生命周期没有
  稳定退出条件。

### Policy：no-go

首席架构师确认 `no-go`：

- 保留 V1 session-aware detach commit/revert。
- 不创建 virtualizer pinning 实现 task。
- 只有未来同时具备 multi-segment column window、reference-hidden overlay policy、
  pinned column/header/body 对齐与浏览器性能证据时，才允许重新立项。

回滚标准：任何 pinning spike 只要导致滚动总宽错误、header/body 偏移、固定列错位、
popup orphan 或 active session 逃逸，即恢复 V1 detach fallback。

## 后续任务拓扑

- [Task 12：Atomic Matrix Paste Prepare / Apply 与错误清单](../spec/task-12-atomic-matrix-paste-prepare-apply.md)
- [Task 13：Printable Key 与 Delete / Backspace](../spec/task-13-printable-key-delete-backspace.md)
- [Task 14：Fill Handle](../spec/task-14-fill-handle.md)
- [Task 15：Server Validation Error 回写 Cell 状态](../spec/task-15-server-validation-error-cell-state.md)

由于 pinning 为 `no-go`，不创建对应实现 task。

## 后续证据

- `TODO (P2)`：条件允许时补采 Windows / macOS Excel 的真实 `text/plain` 样本，
  对比合成 fixture；发现差异时新增兼容 fixture，不静默改写现有 contract。

### Update (2026-07-31)

- 实现状态：Task 12 已完成 E01–E03 parser contract、atomic prepare / batch apply、
  failure / skipped 坐标、10k 上限与分块取消、Excel-compatible copy quoting。
- 依赖关系：Task 12 的目标 unit、typecheck、lint、format、build 和浏览器 smoke
  已通过；Task 13、Task 14 已解除前置依赖。
- 实现状态：Task 13 已完成 printable-to-draft 与 atomic Delete / Backspace；required /
  readonly 失败保持零写入，成功批次只产生一次 `delete` change event。
- 依赖关系：Task 13 的 unit、typecheck、lint、format 和区域选择浏览器 smoke
  已通过；Task 14 继续复用 Task 12 的 immutable plan 与 revision contract。
- 实现状态：Task 14 已完成 fill handle、规则矩形重复、atomic fill plan、pointer /
  auto-scroll 与方向键可访问 fallback；numeric / date sequence 继续关闭。
- 依赖关系：Task 14 的 unit、typecheck、lint、format、build 和区域选择浏览器
  smoke 已通过；Task 15 仅依赖已完成的 Task 11。
- 实现状态：Task 15 已完成 typed server cell error controller、per-cell revision stale
  防护、可访问 cell invalid 状态与员工页部分保存失败适配。
- 依赖关系：Task 15 的 unit、typecheck、lint、format、build 和编辑示例浏览器
  smoke 已通过；Phase 6 Task 11–15 全部完成，无剩余实现依赖。
