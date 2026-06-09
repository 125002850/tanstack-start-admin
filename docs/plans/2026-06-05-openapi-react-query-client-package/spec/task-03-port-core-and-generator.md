# Task 03: Port Core And Generator

**Depends on:** `Task 01`, `Task 02`  
**Blocks:** `Task 04`  
**Type:** `refactor`

## Goal

把当前仓库的 runtime core 与 generator 迁移进独立包，并去掉所有项目内 import/path 假设，让生成产物统一引用 `@oig/react-query-generator/core`。

## Files

- Create: `src/core/body.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/query-key.ts`
- Create: `src/core/response.ts`
- Create: `src/core/transport.ts`
- Create: `src/codegen/lib/client-generation.ts`
- Create: `src/codegen/lib/orval-runner.ts`
- Create: `src/codegen/lib/render-generated-files.ts`
- Create: `src/codegen/commands/generate.ts`
- Create: `src/codegen/commands/fetch-spec.ts`
- Create: `tests/core/query-key.test.ts`
- Create: `tests/core/response.test.ts`
- Create: `tests/core/transport.test.ts`
- Create: `tests/codegen/client-generation.test.ts`
- Create: `tests/codegen/render-generated-files.test.ts`
- Create: `tests/codegen/shim-file.test.ts`
- Modify: `src/core/index.ts`
- Modify: `src/codegen/index.ts`
- Modify: `src/codegen/cli/run-command.ts`
- Reference: `src/lib/api/core/body.ts`
- Reference: `src/lib/api/core/errors.ts`
- Reference: `src/lib/api/core/query-key.ts`
- Reference: `src/lib/api/core/response.ts`
- Reference: `src/lib/api/core/transport.ts`
- Reference: `tools/codegen/lib/client-generation.ts`
- Reference: `tools/codegen/scripts/fetch-spec.ts`
- Reference: `tools/codegen/scripts/generate.ts`

## Invariants

- generated `sdk.ts`、`queries.ts`、`mutations.ts`、`raw.ts` 只能从 `@oig/react-query-generator/core` 获取 runtime 依赖。
- `queryClientImport` 仍然是消费项目提供的配置，不得被 package core 吞掉。
- `generate` 继续负责创建 `adapters/index.ts` 占位和 `src/lib/api/clients/<client>/index.ts` 稳定根入口。
- Orval 自定义 mutator 必须通过 CLI 生成的本地 shim file 接入；生成器本身不得假设 Orval 支持裸 npm package specifier。

## Constraints

- 不要把当前项目的 `@/lib/query-client`、`@/lib/api/core/*` 或 `src/lib/api/core/*` 路径残留到生成模板里。
- 不要对 `raw.ts` 做 post-process rewrite；应改为让 Orval 从本地 shim file 直接生成正确 import。
- shim file 必须是确定性、可重建、可忽略入库的临时文件，例如 `openapi/.generated/orval-mutator.ts`。
- 不要在本 task 中处理 npm 发布或 fixture 接入，那是后续任务。

## Shared Runtime Contracts

- `core-import-surface`
- `manifest-cli-contract`

## Acceptance Criteria

- [ ] `profile: task-03-core` 通过
- [ ] 所有 core 单测迁移到新包后继续通过
- [ ] generator 输出的 `sdk.ts` / `queries.ts` / `mutations.ts` / `raw.ts` 不再包含项目私有 import
- [ ] CLI 会为 Orval 生成 shim file，且 `raw.ts` 通过该 shim 间接导入 `customInstance`
- [ ] `customInstance`、middleware、`InferTransportResult`、`unwrapResponseData`、`buildQueryKey` 语义与当前实现一致

## Verification Profile

- `profile: task-03-core`
  - `pnpm exec vitest run tests/core/query-key.test.ts tests/core/response.test.ts tests/core/transport.test.ts tests/codegen/client-generation.test.ts tests/codegen/render-generated-files.test.ts tests/codegen/shim-file.test.ts`
- `Expected Signals:` 生成模板测试直接断言 runtime import 指向 package core；shim test 断言 shim 文件内容转发到 `@oig/react-query-generator/core`，且 Orval 输出的 `raw.ts` import 指向 shim 文件；core 回归测试覆盖 middleware、error union、query key normalization。

## Verification Strategy

- `refactor` 任务，采用“迁移前行为保持 + 生成模板回归断言”。目标是保留语义同时拆掉路径耦合。

## Browser Gate Role

- `none`

## Manual Verification Exception

- `Waiver Reason:` not needed
- `Automated Smoke Check:` `pnpm exec vitest run tests/core/transport.test.ts`
- `Manual Verification Steps:` none
- `Expected Results:` none
- `Follow-up Automation:` `not needed`, 行为层已由单测覆盖

## Execution Recipe

1. 逐文件迁移 `src/lib/api/core/**` 到新包 `src/core/**`，保持类型与测试覆盖一致。
2. 把 `tools/codegen/lib/client-generation.ts` 与 `scripts/generate.ts` 拆成 `lib/* + commands/*`，并改为接收 `loadClientManifests()` 返回值。
3. 重写模板渲染逻辑，让 `sdk.ts / queries.ts / mutations.ts` 从 `@oig/react-query-generator/core` 导入 runtime。
4. 在 codegen 命令中生成本地 shim file，例如 `<projectRoot>/openapi/.generated/orval-mutator.ts`，内容只做 `export { customInstance } from '@oig/react-query-generator/core';`。
5. 让 Orval `override.mutator.path` 指向该 shim 文件的绝对路径，避免对 `raw.ts` 做任何 post-process rewrite。
6. 保留 `fetch-spec` 快照命名与 `generate --client` 过滤行为。
7. 运行 `profile: task-03-core`。
8. Commit `refactor: port runtime core and generator into package`

## Notes For Executor

- `src/core/index.ts` 应导出完整 runtime 面，避免 generated 代码出现 `.../core/response`、`.../core/query-key` 这类深层路径。
- `render-generated-files.test.ts` 至少要断言：
  - `sdk.ts` 包含 `unwrapResponseData` from `@oig/react-query-generator/core`
  - `queries.ts` 包含 `buildQueryKey` 与 `ApiClientError` from `@oig/react-query-generator/core`
  - `raw.ts` 包含指向 shim file 的 `customInstance` import
- shim file 不是项目源码的一部分；它必须由 CLI 自动生成，并由消费项目 `.gitignore` 覆盖。

## Review (2026-06-05)

### 实际完成项与任务定义的差异

- 已完成 core 迁移、generator 拆分、CLI shim 生成、Orval 接入与回归测试，验收 profile 全部通过。
- 与原 task 定义的唯一实现差异是 shim file 没有采用“只做 `export { customInstance } from '@oig/react-query-generator/core'` 的纯转发”，而是采用“本地 wrapper 函数调用 package core”。这是为了满足 Orval 8.15.0 对 mutator 文件的 AST 解析限制。

### 阻塞项或未预期的技术债务

- 没有阻塞项。
- 未预期约束：Orval 临时 config 不能可靠地从 `/tmp` 目录 `import { defineConfig } from 'orval'`，因此实现改为纯对象默认导出。

### 后续行动项（Action Items）

- `TODO(P1)`: 在 Task 04 的夹具 e2e 中固定 shim wrapper contract，防止后续误回退成纯 re-export。
