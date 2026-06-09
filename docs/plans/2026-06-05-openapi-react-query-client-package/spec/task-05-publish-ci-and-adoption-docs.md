# Task 05: Publish, CI And Adoption Docs

**Depends on:** `Task 04`  
**Blocks:** `none`  
**Type:** `infra`

## Goal

补齐 npm 包发布前的 CI、pack 验证和接入文档，让新仓库能独立交付，并给当前应用仓库提供明确迁移路径。

## Files

- Create: `.github/workflows/ci.yml`
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Create: `docs/consuming-project.md`
- Modify: `README.md`
- Modify: `package.json`
- Reference: `package.json`
- Reference: `docs/plans/2026-06-04-openapi-react-query-api-client-design.md`

## Invariants

- README 必须明确写出安装命令、项目目录要求、`.gitignore` 要求和 CLI 用法。
- CI 必须以“生成可重建”为前置，再跑类型检查和测试。
- 发布流程不能要求消费项目提交 `generated/**`。
- 迁移文档必须明确指出配置文件从旧仓库内嵌路径 `tools/codegen/config/clients.ts` 迁移为消费项目根目录的 `openapi/clients.ts`。

## Constraints

- 不在本 task 引入 monorepo 或文档站；只做当前独立包仓库发布所需的最小设施。
- 不把当前应用仓库的业务说明复制进包 README，只保留接入与迁移相关内容。

## Shared Runtime Contracts

- `manifest-cli-contract`

## Acceptance Criteria

- [ ] `profile: task-05-core` 通过
- [ ] README 和 `docs/consuming-project.md` 明确展示 `npm install @oig/react-query-generator` 与 `npx openapi-client generate --client dict`
- [ ] `docs/consuming-project.md` 明确写出 manifest 配置路径从 `tools/codegen/config/clients.ts` 迁移到 `openapi/clients.ts`
- [ ] CI 包含 build、unit、fixture e2e、`npm pack --dry-run`
- [ ] 文档明确声明消费项目只保留 `manifest + specs + adapters`，`generated/**` 默认不入库

## Verification Profile

- `profile: task-05-core`
  - `pnpm build`
  - `pnpm exec vitest run`
  - `pnpm pack --dry-run`
- `Expected Signals:` CI 本地等价命令全部通过；`pnpm pack --dry-run` 包含 `dist/**`、`README.md`，不包含夹具生成产物。

## Verification Strategy

- `infra` 任务，采用发布前构建链验证。这里验证的是交付能力和文档闭环。

## Browser Gate Role

- `none`

## Manual Verification Exception

- `Waiver Reason:` not needed
- `Automated Smoke Check:` `pnpm pack --dry-run`
- `Manual Verification Steps:` none
- `Expected Results:` none
- `Follow-up Automation:` `not needed`, pack/CI 已能覆盖发布前路径

## Execution Recipe

1. 在 `README.md` 中补齐安装、CLI、项目目录结构、`.gitignore` 和 CI 推荐写法。
2. 新增 `docs/consuming-project.md`，记录从当前嵌入式方案迁移到独立包的步骤，明确把 manifest 从 `tools/codegen/config/clients.ts` 移到 `openapi/clients.ts`。
3. 配置 GitHub Actions CI：`pnpm install -> pnpm build -> pnpm exec vitest run -> pnpm pack --dry-run`。
4. 增加 changesets 基础配置，为后续 npm 发布做准备。
5. 运行 `profile: task-05-core`。
6. Commit `docs: add publish workflow and adoption guide`

## Notes For Executor

- README 中必须出现这段接入结论：
  - 包内：`core + codegen + cli`
  - 项目内：`openapi/specs/** + openapi/clients.ts + src/lib/api/clients/*/adapters/**`
  - `src/lib/api/clients/*/generated/**`：本地与 CI 生成，不提交远程仓库

## Review (2026-06-05)

### 实际完成项与任务定义的差异

- CI、changesets 基础配置、README、迁移文档和发布前验证脚本均已落地，`profile: task-05-core` 通过。
- 除任务定义外，本 task 还顺手修复了 `load-client-manifests.test.ts` 对本机绝对路径的硬编码，避免测试只在当前机器上成立。

### 阻塞项或未预期的技术债务

- 没有阻塞项。
- 尚未初始化 git 仓库或真正连接 npm registry；这不属于本 task 的目标范围。

### 后续行动项（Action Items）

- `TODO(P1)`: 正式发布前初始化 git 仓库、补 registry 凭据，并接入 `@changesets/cli` 的实际版本流。
