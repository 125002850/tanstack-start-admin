# Task 04: Fixture Project And End-To-End Verification

**Depends on:** `Task 03`  
**Blocks:** `Task 05`  
**Type:** `wiring`

## Goal

建立一个最小消费项目夹具，证明安装包后项目侧只保留 `manifest + specs + adapters` 即可通过 `npx openapi-client generate --client xxx` 生成、类型检查并消费生成产物。

## Files

- Create: `fixtures/project-basic/package.json`
- Create: `fixtures/project-basic/tsconfig.json`
- Create: `fixtures/project-basic/.gitignore`
- Create: `fixtures/project-basic/openapi/clients.ts`
- Create: `fixtures/project-basic/openapi/specs/java-demo.json`
- Create: `fixtures/project-basic/src/lib/query-client.ts`
- Create: `fixtures/project-basic/src/lib/api/clients/dict/adapters/index.ts`
- Create: `fixtures/project-basic/src/lib/api/clients/dict/index.ts`
- Create: `fixtures/project-basic/src/smoke.ts`
- Create: `tests/e2e/fixture-project.spec.ts`
- Modify: `package.json`
- Reference: `src/lib/query-client.ts`
- Reference: `openapi/specs/java-demo.json`
- Reference: `src/lib/api/clients/dict/adapters/index.ts`

## Invariants

- 夹具项目中不得存在 `src/lib/api/core/**`。
- 夹具项目中的 `generated/**` 必须由 CLI 创建，而不是预置在仓库里。
- 夹具项目的 `.gitignore` 必须包含 `src/lib/api/clients/*/generated/`。
- 夹具项目的 `.gitignore` 还必须覆盖 `openapi/.generated/`，因为 shim file 是 CLI 生成的临时桥接文件。
- 夹具项目 `package.json` 必须显式安装与 package peer range 兼容的 `@tanstack/react-query`，否则 generated 代码无法通过 `tsc --noEmit`。

## Constraints

- 夹具只验证单个 `dict` client 即可，不要在本 task 扩大到多个项目模板。
- 不要依赖当前应用仓库的 TanStack Start 运行环境；夹具应是最小可 typecheck 的 TypeScript 项目。

## Shared Runtime Contracts

- `core-import-surface`
- `manifest-cli-contract`

## Acceptance Criteria

- [ ] `profile: task-04-core` 通过
- [ ] `pnpm exec openapi-client generate --client dict` 可在夹具项目中生成 client
- [ ] 夹具 `src/smoke.ts` 能从 generated 入口和 package `/core` 正常类型通过
- [ ] 夹具 `package.json` 包含 `@tanstack/react-query`，且 `pnpm exec tsc --noEmit` 不会因缺少该依赖失败
- [ ] 夹具项目会生成 `openapi/.generated/orval-mutator.ts`，且该文件被 `.gitignore` 覆盖
- [ ] 夹具 `.gitignore` 覆盖 `generated/**`，并能通过 `git check-ignore` 验证

## Verification Profile

- `profile: task-04-core`
  - `pnpm build`
  - `pnpm exec vitest run tests/e2e/fixture-project.spec.ts`
- `Expected Signals:` e2e 测试在临时目录初始化 `git` 后，`git check-ignore src/lib/api/clients/dict/generated/sdk.ts` 与 `git check-ignore openapi/.generated/orval-mutator.ts` 都返回命中；夹具 `pnpm exec tsc --noEmit` 通过。

## Verification Strategy

- `wiring` 任务，采用真实 CLI + 真实夹具项目的集成 smoke。它验证的是安装与接入路径，而不是纯模板字符串。

## Browser Gate Role

- `none`

## Manual Verification Exception

- `Waiver Reason:` not needed
- `Automated Smoke Check:` `pnpm exec vitest run tests/e2e/fixture-project.spec.ts`
- `Manual Verification Steps:` none
- `Expected Results:` none
- `Follow-up Automation:` `not needed`, 夹具项目已经承担最小集成验证

## Execution Recipe

1. 新建 `fixtures/project-basic`，只保留 `openapi/clients.ts`、`openapi/specs/**`、`src/lib/query-client.ts`、`src/lib/api/clients/dict/adapters/index.ts` 与 `src/smoke.ts`。
2. 在 `fixtures/project-basic/package.json` 中显式安装：
   - `@oig/react-query-generator`
   - `@tanstack/react-query`
   - `typescript`
3. 让夹具项目通过 `workspace:*` 或本地包引用安装当前 package，并在 `package.json` 暴露 `typecheck` 脚本。
4. 在 e2e 测试中执行 `openapi-client generate --cwd fixtures/project-basic --client dict`。
5. 断言生成后的 shim file 内容转发到 `@oig/react-query-generator/core`，且 `raw.ts` 通过 shim 间接导入 `customInstance`。
6. 断言生成后的文件从 `@oig/react-query-generator/core` 导入 runtime，且夹具项目没有本地 core 目录。
7. 在临时 git 仓库中运行 `git check-ignore src/lib/api/clients/dict/generated/sdk.ts` 与 `git check-ignore openapi/.generated/orval-mutator.ts`。
8. 运行 `profile: task-04-core`。
9. Commit `test: add fixture project for package integration`

## Notes For Executor

- `fixtures/project-basic/src/smoke.ts` 应至少包含：
  - `import { listGlobalTypesQueryOptions } from './lib/api/clients/dict/generated';`
  - `import { unwrapResponseData } from '@oig/react-query-generator/core';`
  - 一次静态类型消费，证明 package core 与 generated typing 同时成立。

## Review (2026-06-05)

### 实际完成项与任务定义的差异

- 夹具项目和 e2e 验证已完整落地，`profile: task-04-core` 通过。
- 与原 task 定义相比，e2e 额外吸收了一个真实安装前置：pnpm 11 首次安装时若命中 `ERR_PNPM_IGNORED_BUILDS`，测试会先执行 `pnpm approve-builds --all` 再继续。这不改变包契约，只是把依赖安装的安全前置显式化。
- Task 04 执行中顺带修复了包内 CLI 双 shebang 问题，这是 fixture 真实调用 `pnpm exec openapi-client` 时暴露出来的交付缺陷。

### 阻塞项或未预期的技术债务

- 没有阻塞项。
- 需要在 Task 05 文档中明确 pnpm 11 对 `esbuild` build script 的审批要求，否则消费方首次安装可能困惑。

### 后续行动项（Action Items）

- `TODO(P1)`: 在 Task 05 README 与迁移文档中增加 pnpm 11 `approve-builds` 说明。
