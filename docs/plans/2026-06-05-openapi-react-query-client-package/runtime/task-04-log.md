# Execution Log - Task 04

**Agent:** Codex
**Started:** 2026-06-05 15:21
**Completed:** 2026-06-05 15:23

## Result

`pass`

## What Was Done

- 补齐了 `fixtures/project-basic` 的最小消费项目骨架：`package.json`、`tsconfig.json`、`.gitignore`、`openapi/clients.ts`、`src/smoke.ts` 和稳定 client 入口。
- 新增 `tests/e2e/fixture-project.spec.ts`，真实执行 `pnpm install -> openapi-client generate --client dict -> tsc --noEmit -> git check-ignore`。
- 夹具 manifest 固定从 `@oig/react-query-generator/codegen` 导入 `defineClientManifests`，并通过 `queryClientImport` 验证 mutations 生成仍能引用消费项目的 query client。
- e2e 中加入 pnpm 11 build-script guard 处理：命中 `ERR_PNPM_IGNORED_BUILDS` 时自动执行 `pnpm approve-builds --all` 再重试安装。
- Task 04 执行中顺带修复了包内 CLI 双 shebang 问题：删除 `cli.ts` 源文件 shebang，只保留 tsup banner，避免 fixture 中 `pnpm exec openapi-client` 语法错误。
- Commits: `none`

## Executor Self-Verification

- `pnpm build` -> `PASS`
- `pnpm exec vitest run tests/e2e/fixture-project.spec.ts` -> `PASS`

## Unfinished Work

- [ ] Task 05 尚未补齐 README、迁移文档、CI 和 `pnpm pack --dry-run` 发布前验证

## Surprises

- pnpm 11 在全新消费项目里会再次拦截 `esbuild` build script；即使主仓库已经批准过，也不能假设 fixture 环境自动继承。
- `pnpm exec openapi-client` 暴露了 CLI 产物双 shebang 的打包问题，这个问题在本地直接 `node dist/cli.js` 时不明显，但在真实 package bin 链路下会立即失败。

## Handoff Notes

- Task 05 的 README 和迁移文档需要明确声明：`generated/**` 与 `openapi/.generated/**` 都不提交远程仓库。
- 文档还需要补一条 pnpm 11 备注：若首次安装命中 ignored builds，需要批准 `esbuild` 的 build script。
