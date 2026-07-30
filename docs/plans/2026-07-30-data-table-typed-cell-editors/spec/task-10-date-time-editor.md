# Task 10：DateTime Editor

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 09

**Blocks:** Task 11

**Type:** feature

## Goal

在 Date Editor 已验证的 Temporal 基础上交付 `dateTime`，严格区分 instant 与 local 领域语义，完成显式时区解析、DST gap/overlap 校验、时间输入和 explicit-confirm 生命周期。

## Files

- Create: `src/components/ui/table/columns/data-table-time-zone.ts`
- Create: `src/components/ui/table/columns/data-table-time-zone.test.ts`
- Modify: `src/components/ui/table/cells/data-table-editable-date-cell.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-date-cell.test.tsx`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.test.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/elements/components/data-table-editable-choice-contract-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

如 Date 与 DateTime 的 UI 在实现中证明无法保持单一组件清晰，可在 Review 前提出拆分 `data-table-editable-date-time-cell.tsx`；不得在无证据时预先复制整套 Temporal 生命周期。

## Invariants

- `valueKind: 'instant' | 'local'` 必填，禁止通过字符串形状推断。
- instant 使用带 `Z` 或 offset 的规范 ISO 字符串。
- local 使用无时区的规范 local datetime 字符串，不调用 `toISOString()`。
- instant 时区按 column → table → app 解析。
- 不 fallback 到浏览器、服务器或用户机器时区。
- column-bound codec 创建时固定 resolved time zone。
- 缺失或非法时区：开发/测试抛出可定位错误；生产 fail closed 并禁用该列编辑。
- DST gap invalid；overlap 未明确 offset/disambiguation 时 invalid。

## Interaction Contract

- popup 包含 Calendar、时间输入、确定、取消和可选清除。
- 选择日期不立即提交。
- 空值首次选日期使用 `defaultTime`。
- Enter 在时间合法时确认。
- Escape 取消整个 session。
- 点击确定统一 parse、validate、commit。
- virtual detach 时 explicit-confirm session revert。

## Dependency Gate

本 task 默认复用现有依赖。如果无法在当前依赖面内正确实现 IANA 时区和 DST overlap/gap：

1. 停止实现。
2. 记录具体失败样本和当前依赖能力缺口。
3. 提交单独的架构/依赖决策。
4. 不在本 feature task 中夹带依赖新增或升级。

## Out of Scope

- 不在业务页面分散编写 `new Date(rawValue)` 适配。
- 不自动选择 DST overlap 的 `earlier` 或 `later`。
- 不支持未定义语义的后端裸 `YYYY-MM-DD HH:mm:ss` 直接写入。

## Acceptance Criteria

- [ ] instant/local round-trip 均保持领域语义。
- [ ] column/table/app 时区优先级和 source 可测试。
- [ ] 缺失/非法时区 fail closed。
- [ ] DST gap、overlap、offset string 和 UTC `Z` string 测试通过。
- [ ] minute/second granularity、step、min/max 和 defaultTime 通过。
- [ ] explicit-confirm、取消、outside close 和 detach 生命周期通过。
- [ ] API 非规范字符串只在共享 adapter/codec 边界归一化。
- [ ] 全部 gate 条件通过后才公开 `dateTime`。
- [ ] V1 统一出口验证通过。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/columns/data-table-time-zone.test.ts src/components/ui/table/cells/data-table-editable-date-cell.test.tsx src/components/ui/table/columns/data-table-edit-codecs.test.ts src/components/ui/table/columns/data-table-edit-adapters.test.ts src/components/ui/table/columns/data-table-column-factory.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

V1 出口：

```bash
pnpm check
pnpm build
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先补 resolver、instant/local、DST 和 explicit-confirm 失败测试。
2. 实现时区 resolver；若依赖能力不足，执行 Dependency Gate。
3. 扩展 Temporal codec 和 editor，保持 gate 关闭。
4. 接入 API 边界、overlay、keyboard shell 和 detach lifecycle。
5. 扩展示例页和 browser smoke。
6. 完成 V1 出口验证后打开 `dateTime` gate。
7. 完成统一 Review 与父设计状态回写。
