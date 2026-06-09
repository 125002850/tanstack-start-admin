# Audit - core-import-surface

**Auditor:** Codex
**Decision:** `pass`

## Scope

验证 package core 导入面是否已经替代项目私有 runtime 路径，并覆盖 Task 01、Task 03、Task 04 的共享 contract。

## Evidence

- `~/work/react-query-generator/tests/codegen/render-generated-files.test.ts`
- `~/work/react-query-generator/tests/codegen/shim-file.test.ts`
- `~/work/react-query-generator/tests/e2e/fixture-project.spec.ts`
- `~/work/react-query-generator/fixtures/project-basic/src/smoke.ts`

## Findings

- `sdk.ts`、`queries.ts`、`mutations.ts` 生成模板都已断言从 `@oig/react-query-generator/core` 导入 runtime。
- `raw.ts` 不再引用项目私有 `core` 路径，而是通过 CLI 生成的 `openapi/.generated/orval-mutator.ts` 间接接入 package core。
- fixture e2e 明确断言消费项目不存在本地 `src/lib/api/core/**`，并且 `tsc --noEmit` 通过。

## Residual Risks

- `none`
