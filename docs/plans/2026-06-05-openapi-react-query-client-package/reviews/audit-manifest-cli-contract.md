# Audit - manifest-cli-contract

**Auditor:** Codex
**Decision:** `pass`

## Scope

验证 manifest 位置、CLI 参数契约、fixture 消费链路以及迁移文档是否覆盖 Task 02、Task 03、Task 04、Task 05 的共享 contract。

## Evidence

- `~/work/react-query-generator/tests/codegen/args.test.ts`
- `~/work/react-query-generator/tests/codegen/load-client-manifests.test.ts`
- `~/work/react-query-generator/tests/e2e/fixture-project.spec.ts`
- `~/work/react-query-generator/README.md`
- `~/work/react-query-generator/docs/consuming-project.md`

## Findings

- CLI 已支持 `generate|fetch-spec`、`--client`、`--config`、`--cwd`。
- manifest 默认路径已经固定为消费项目根目录 `openapi/clients.ts`，并由文档明确指出从旧路径 `tools/codegen/config/clients.ts` 迁移。
- fixture e2e 证明 `npx/pnpm exec openapi-client generate --client dict` 能在最小消费项目中真实生成、typecheck 并通过 `.gitignore` 验证。

## Residual Risks

- `none`
