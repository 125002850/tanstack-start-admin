# Task 12：Atomic Matrix Paste Prepare / Apply 与错误清单

**Parent Decision:** [Phase 6 决策](../reviews/phase-6-decision.md)

**Status:** COMPLETE

**Depends On:** Task 11

**Blocks:** Task 13、Task 14

**Type:** feature

## Goal

按已确认的 `atomic` policy 交付 typed matrix paste：
`preparePaste() → PastePlan → applyPaste()`。完整矩形在 parse、validate、权限和边界检查
全部通过后才允许一次性写入，并提供可定位的错误 / skipped 坐标。

## Files

- Create: `src/components/ui/table/core/data-table-matrix-paste.ts`
- Create: `src/components/ui/table/core/data-table-matrix-paste.test.ts`
- Reference: `../reviews/fixtures/phase-6-synthetic-excel-clipboard.json`
- Modify: `src/components/ui/table/core/data-table-cell-range.ts`
- Modify: `src/components/ui/table/core/data-table-body.tsx`
- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `e2e/data-table-cell-range-selection.smoke.spec.ts`

## Invariants

- 任何失败都不修改 draft、active session、selection 或业务 snapshot。
- 每个目标 cell 使用自身 column-bound codec。
- 不先写成功 cell 再回滚。
- plan 固定 source/target shape、table revision、operation、failure 和 skipped 坐标。
- apply 只接受未过期且 `ready` 的 plan。
- apply 只触发一次 `onChange`，changes 顺序稳定且可审计。
- readonly、越界、隐藏列、不可编辑字段和缺失 codec 都必须显式进入错误清单。
- textarea 的 Excel quoted multiline cell 不得被拆成额外行。

## Acceptance Criteria

- [x] 首席架构师批准的合成 Excel-compatible E01–E03 fixture 解析通过。
- [x] `preparePaste()` 对所有 cell 完成 parse / validate 后才返回 ready。
- [x] 任一失败令 atomic plan invalid，snapshot 保持零写入。
- [x] `applyPaste()` 单 transaction 更新所有目标并只发一次 change event。
- [x] failure / skipped 含 source 与 target row/column 坐标、columnId 和错误文本。
- [x] readonly、越界、跨 pinned column、隐藏列和 textarea 换行通过。
- [x] stale plan、并发编辑 session 和 table revision 变化 fail closed。
- [x] 10k cell prepare 不长期阻塞主线程，并具备上限、分块让步和取消路径。
- [x] copy → paste round-trip 对所有 V1 typed editor 保持领域值。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/core/data-table-matrix-paste.test.ts src/components/ui/table/core/data-table-cell-range.test.ts src/components/ui/table/core/data-table.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先把已批准的合成 Excel-compatible clipboard 样本固化为 parser contract tests。
2. 定义 immutable `PastePlan`、failure / skipped coordinate 和 revision contract。
3. 实现只读 `preparePaste()`，保持 matrix paste gate 关闭。
4. 实现 editing runtime 的 atomic batch transaction 与单次 change event。
5. 接入 selection paste、错误呈现、性能上限和取消。
6. 完成真实浏览器 ClipboardEvent round-trip 后开放 matrix paste gate。
7. 完成 Review 与父 decision 状态回写。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 新增 Excel-compatible TSV parser，覆盖 CRLF、quoted multiline、escaped quote、ragged
  row、10k cell 上限和取消。
- 新增 immutable matrix paste plan，完整记录 revision、source / target shape、
  operation、failure 和 skipped 坐标。
- editing runtime 新增 revision 与 atomic batch transaction；完整 preflight 后一次更新
  draft，并且只触发一次 `onChange`。
- selection paste 已接入异步分块 prepare、range / request 取消、stale plan 防护和首个
  failure 坐标 toast。
- copy TSV 新增 Excel-compatible quoting；choice / switch clipboard codec 补齐静态
  numeric、multiple 和 remote JSON 的领域类型 round-trip。
- 原 task 使用概念名 `preparePaste()` / `applyPaste()`；实际公共内部函数命名为
  `prepareDataTableMatrixPaste()`，apply 收敛为 editing runtime 的 `applyBatch()`。

### 阻塞项或未预期的技术债务

- 无剩余阻塞项；Task 13、Task 14 已解除前置依赖。
- UI 当前只展示 plan 的首个 failure；完整 failure / skipped 清单保留在 plan 内部，
  若未来需要批量错误面板应独立设计。
- 10k 上限采用每 250 cell 主线程让步；不是 Web Worker。更大规模仍明确 fail closed。
- 真实 Excel 跨平台采样仍是 Task 11 记录的 P2 兼容性证据，不阻塞当前实现。

### 后续行动项（Action Items）

- `TODO (P0)`：Task 13 复用 atomic batch runtime 实现 Delete / Backspace 多 cell 清空。
- `TODO (P0)`：Task 14 复用 immutable plan 与 revision contract 实现 fill handle。
- `TODO (P1)`：未来错误面板需要展示全部 failure / skipped 时，不要把 UI 状态塞回
  codec。
- `TODO (P2)`：补采 Windows / macOS Excel clipboard，并以新增 fixture 处理差异。

### 验证结果

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 目标 Vitest：6 files、170 tests 全部通过。
- `pnpm exec oxfmt --check ...`：14 个本 task 文件全部通过。
- production build：通过。
- `data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2`：6 / 6 通过。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- clipboard parser、matrix plan、atomic batch 和 selection toast 的用户可见错误已统一
  切换到 DataTable 中文消息目录。
- 首个 failure 的 source / target 坐标改为中文行列描述；plan code、零写入 atomic
  语义、坐标字段和 apply contract 均未变化。

### 验证结果

- matrix / fill / editing 定向回归包含在 9 个文件、117 个测试中并通过。
- 范围选择 Playwright 8 / 8 通过，覆盖中文失败原因与中文 source / target 坐标。

### 阻塞项或未预期的技术债务

- 无新增阻塞；完整 failure 列表仍只保存在 plan，UI 继续只展示第一项。

### 后续行动项（Action Items）

- `TODO (P1)`：未来批量错误面板直接渲染 failure code + coordinate + params，不以最终
  中文字符串作为逻辑判断条件。
