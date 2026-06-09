# Execution Log - Task 03

**Agent:** Codex
**Started:** 2026-06-05 15:20
**Completed:** 2026-06-05 15:21

## Result

`pass`

## What Was Done

- 在 `~/work/react-query-generator/src/core/**` 迁入运行时基座，并保留 `customInstance`、middleware、`InferTransportResult`、`unwrapResponseData`、`buildQueryKey` 的语义与测试覆盖。
- 落地 `src/codegen/lib/{client-generation,render-generated-files,orval-runner}.ts` 以及 `src/codegen/commands/{generate,fetch-spec}.ts`，让生成产物统一从 `@oig/react-query-generator/core` 获取 runtime 依赖。
- 为 Orval 接入增加 CLI 自动生成的 shim file：`openapi/.generated/orval-mutator.ts`。实际实现从“纯 re-export”调整为“本地 wrapper 调包内 core”，以满足 Orval 对 mutator 的 AST 解析要求。
- 新增 `tests/codegen/{client-generation,render-generated-files,shim-file}.test.ts`，覆盖模板输出和 Orval shim 集成。
- 修正迁移后 core 单测的 import 目标，确保测试指向新包 `src/core/**`。
- Commits: `none`

## Executor Self-Verification

- `pnpm build` -> `PASS`
- `pnpm exec vitest run tests/core/query-key.test.ts tests/core/response.test.ts tests/core/transport.test.ts tests/codegen/client-generation.test.ts tests/codegen/render-generated-files.test.ts tests/codegen/shim-file.test.ts` -> `PASS`

## Unfinished Work

- [ ] Task 04 尚未建立完整夹具项目和真实消费侧 e2e 验证

## Surprises

- Orval 8.15.0 虽然支持 `override.mutator.path`，但它会对 mutator 文件做 bundle + AST 解析，只接受“本地定义的导出函数”，不能接受 `export { customInstance } from '@oig/react-query-generator/core'` 这种纯 re-export。
- Orval 临时 config 文件如果放在 `/tmp` 下再 `import { defineConfig } from 'orval'`，会因为模块解析基于 config 目录而找不到包；改成 `export default { ... }` 纯对象配置后问题消失。

## Handoff Notes

- Task 04 的夹具项目需要显式安装 `@tanstack/react-query`，并验证 `.gitignore` 同时覆盖 `generated/**` 与 `openapi/.generated/**`。
- e2e 断言应以“shim 本地 wrapper 调 package core”作为真实 contract，而不是早期计划中的“纯 re-export”。
