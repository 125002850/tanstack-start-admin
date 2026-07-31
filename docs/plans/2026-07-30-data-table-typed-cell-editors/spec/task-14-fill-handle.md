# Task 14：Fill Handle

**Parent Decision:** [Phase 6 决策](../reviews/phase-6-decision.md)

**Status:** COMPLETE

**Depends On:** Task 12

**Blocks:** None

**Type:** feature

## Goal

在 range selection 上交付可访问的 fill handle，复用 atomic `PastePlan` 扩展单值、重复矩形
和明确支持的序列，不引入绕过 codec 的批量写入路径。

## Files

- Create: `src/components/data-table/core/data-table-fill-plan.ts`
- Create: `src/components/data-table/core/data-table-fill-plan.test.ts`
- Modify: `src/components/data-table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/data-table/core/data-table.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `e2e/data-table-cell-range-selection.smoke.spec.ts`

## Invariants

- fill 先生成完整 plan，再 atomic apply。
- V1 默认支持单值复制和矩形重复；数值 / 日期序列必须单独由测试证明后开放。
- 每个目标 cell 重新执行自身 codec parse / validate。
- readonly、越界、required、隐藏列和 pinned boundary 任一失败均零写入。
- pointer capture、auto-scroll、RTL 和 touch 行为不得破坏现有 range selection。
- fill handle 不作为 virtualizer pinning 的旁路。

## Acceptance Criteria

- [x] 单值、横向/纵向矩形重复与反向拖拽通过。
- [x] 不规则 source/target shape fail closed。
- [x] typed codec、atomic failure 坐标和单次 change event 通过。
- [x] readonly、pinned boundary、虚拟滚动和 auto-scroll 通过。
- [x] 键盘与 screen reader 有等价操作或明确可访问 fallback。
- [x] range copy/paste、column drag 和 row expand 无回归。

## Verification Profile

```bash
pnpm exec vitest run src/components/data-table/core/data-table-fill-plan.test.ts src/components/data-table/core/data-table.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先冻结 source/target shape 与 atomic failure 测试。
2. 实现纯 `prepareFill()`，输出 Task 12 兼容 plan。
3. 接入 handle、pointer capture、auto-scroll 与可访问 fallback。
4. 验证虚拟列表和 pinned boundary。
5. 完成 Review。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 新增纯 `prepareDataTableFillPlan()`：只接受沿 source 完整边扩展的相邻矩形，先把
  source 按领域值格式化，再由每个 target column-bound codec 重新 parse / validate。
- V1 已开放单值复制、横向 / 纵向矩形重复和四个方向的反向填充；numeric source 也只
  重复原矩形，不推断序列。
- fill plan 复用 Task 12 的 immutable operation / failure / skipped、revision 和
  `applyBatch()`，成功只触发一次 `reason: 'fill'` change event。
- handle 使用真实 button，提供 screen reader 名称与方向键 fallback；pointer capture、
  preview、auto-scroll、RTL 水平方向映射和 touch-action 均在 selection hook 内收敛。
- 原 task 预估在 `data-table.tsx` 放置 handle；实际 handle 必须随普通 / 行虚拟 /
  列虚拟三条 cell 渲染路径移动，因此局部修改 `data-table-body.tsx`，并在
  `globals.css` 增加交互样式，未创建顶层 overlay。

### 阻塞项或未预期的技术债务

- 无剩余阻塞项。
- 数值 / 日期序列推断未开放；当前明确保持矩形重复，避免未定义的日期粒度、DST、
  decimal step 与跨列领域类型语义。
- pinned cell 不进入 selectable range；纯 plan 保留 pinned boundary failure contract，
  UI 不把 fill handle 作为 pinning `no-go` 的旁路。
- 浏览器首次验证发现跨 cell 边界的 9px 控制点会与相邻 cell 命中竞争；最终点击区完整
  内收至当前 cell，并由真实 E2E 证明拖拽目标稳定。

### 后续行动项（Action Items）

- `TODO (P1)`：如需 numeric / civil-date 序列，单独定义 inference、step、DST 和反向
  序列 contract 后立项，不在当前 repeat planner 内隐式开放。
- `TODO (P2)`：补充真实触摸设备的长距离 fill 与惯性滚动证据。

### 验证结果

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 规格目标 Vitest：2 files、115 tests 全部通过。
- 扩展 fill / matrix / editing 回归：4 files、154 tests 全部通过；随后新增的两个
  V1 边界测试单文件 15 / 15 通过。
- `pnpm exec oxfmt --check ...`：9 个 Task 14 文件全部通过。
- `git diff --check`：通过。
- `data-table-cell-range-selection.smoke.spec.ts`：8 / 8 通过，包含 production build。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- fill shape、source codec、active edit、越界和 preparation fallback 的用户可见提示已
  统一为 DataTable 中文消息目录；fill 继续复用 matrix failure 坐标格式。
- 未修改 pointer、keyboard、RTL、repeat plan 或 atomic apply 行为。

### 验证结果

- fill 定向回归与范围选择 Playwright 8 / 8 通过，production build 通过。

### 阻塞项或未预期的技术债务

- 无新增阻塞。

### 后续行动项（Action Items）

- `TODO (P2)`：新增序列填充类型时，为新增 failure code 同步提供 catalog 消息函数和
  locale 参数测试。
