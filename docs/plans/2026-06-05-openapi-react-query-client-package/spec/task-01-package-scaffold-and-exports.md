# Task 01: Package Scaffold And Export Contract

**Depends on:** `none`  
**Blocks:** `Task 02`, `Task 03`  
**Type:** `infra`

## Goal

建立独立 npm 包仓库的骨架、构建脚本和公开导出面，锁定 `@oig/react-query-generator/core`、`@oig/react-query-generator/codegen` 与 `openapi-client` 三个稳定入口。

## Files

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `cli.ts`
- Create: `src/index.ts`
- Create: `src/core/index.ts`
- Create: `src/codegen/index.ts`
- Create: `vitest.config.ts`
- Create: `tests/smoke/package-exports.test.ts`
- Create: `tests/smoke/package-manifest.test.ts`
- Create: `README.md`
- Reference: `src/lib/api/core/transport.ts`
- Reference: `src/lib/api/core/response.ts`
- Reference: `tools/codegen/scripts/generate.ts`

## Invariants

- `@oig/react-query-generator/core` 必须是 runtime 的唯一公共导入面。
- `openapi-client` 必须作为 package binary 发布，而不是要求消费者调用仓库内脚本。
- 包内不能出现任何当前项目别名导入，例如 `@/lib/...`。
- `package.json` 必须声明 `peerDependencies["@tanstack/react-query"]`，因为 generated 产物直接 import `queryOptions` / `mutationOptions`。
- `orval` 在本包中视为 **implementation detail**，必须放在包自己的 `dependencies`，而不是要求消费项目额外安装。

## Constraints

- 不要在本 task 中实现完整 generator 逻辑，只定义目录、exports 和 binary 装配点。
- 不要把 scope 名写死到生成模板常量；scope 只存在于 `package.json` exports 和测试断言。
- 不要把 `orval` 暴露为 peerDependency；CLI 和 codegen 子模块必须在包内自洽运行。

## Shared Runtime Contracts

- `core-import-surface`

## Acceptance Criteria

- [ ] `profile: task-01-core` 通过
- [ ] `package.json` 暴露 `exports["./core"]`、`exports["./codegen"]` 和 `bin.openapi-client`
- [ ] `package.json` 明确声明 `peerDependencies["@tanstack/react-query"]` 与 `dependencies.orval`
- [ ] `tests/smoke/package-exports.test.ts` 验证 build 后可解析三个公开入口

## Verification Profile

- `profile: task-01-core`
  - `pnpm install`
  - `pnpm build`
  - `pnpm exec vitest run tests/smoke/package-exports.test.ts tests/smoke/package-manifest.test.ts`
- `Expected Signals:` `dist/cli.js`、`dist/core/index.js`、`dist/codegen/index.js` 生成成功；测试可 `import('@oig/react-query-generator/core')` 并读取命名导出，同时断言 `package.json` 包含 `peerDependencies["@tanstack/react-query"]` 与 `dependencies.orval`。

## Verification Strategy

- `infra` 任务，采用构建 + 入口 smoke check。这里验证的是发布骨架，不是功能行为。

## Browser Gate Role

- `none`

## Manual Verification Exception

- `Waiver Reason:` not needed
- `Automated Smoke Check:` `pnpm exec vitest run tests/smoke/package-exports.test.ts`
- `Manual Verification Steps:` none
- `Expected Results:` none
- `Follow-up Automation:` `not needed`, 该任务已由 build/export smoke 覆盖

## Execution Recipe

1. 初始化独立包仓库的 `package.json`、`tsconfig.json`、`tsup.config.ts` 与 `vitest.config.ts`。
2. 在 `package.json` 中写明：
   - `peerDependencies["@tanstack/react-query"]`
   - `dependencies.orval`
   - `bin.openapi-client`
   - `exports["./core"]` 与 `exports["./codegen"]`
3. 建立 `src/index.ts`、`src/core/index.ts`、`src/codegen/index.ts` 的最小导出骨架。
4. 在 `cli.ts` 中只接线到占位命令入口，保证 binary 可 build，但暂不实现完整命令。
5. 新增 `tests/smoke/package-exports.test.ts` 与 `tests/smoke/package-manifest.test.ts`，分别验证导出面和 package contract。
6. 运行 `profile: task-01-core`。
7. Commit `feat: scaffold openapi react query client package`

## Notes For Executor

- `src/core/index.ts` 至少要预留这些命名导出：`customInstance`、`registerTransportMiddleware`、`clearTransportMiddlewares`、`unwrapResponseData`、`buildQueryKey`、`ApiClientError`、`objectToFormData`。
- binary 名固定为 `openapi-client`，包名固定为 `@oig/react-query-generator`，subpath 结构不能变。
- `@tanstack/react-query` 的版本范围必须以 generated 产物依赖的 API 面为准；最低要覆盖 `queryOptions` / `mutationOptions` 所需的 TanStack Query v5。
