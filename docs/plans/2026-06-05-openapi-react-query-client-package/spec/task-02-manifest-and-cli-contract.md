# Task 02: Manifest And CLI Contract

**Depends on:** `Task 01`  
**Blocks:** `Task 03`  
**Type:** `infra`

## Goal

定义“消费项目只保留 manifest + specs + adapters”的配置契约，并实现 CLI 对项目 `openapi/clients.ts` 的默认发现、加载与 `--client` 过滤。

## Files

- Create: `src/codegen/config/schema.ts`
- Create: `src/codegen/config/define-client-manifests.ts`
- Create: `src/codegen/config/load-client-manifests.ts`
- Create: `src/codegen/cli/args.ts`
- Create: `src/codegen/cli/run-command.ts`
- Create: `tests/codegen/schema.test.ts`
- Create: `tests/codegen/load-client-manifests.test.ts`
- Create: `tests/codegen/args.test.ts`
- Modify: `cli.ts`
- Reference: `tools/codegen/config/schema.ts`
- Reference: `tools/codegen/config/clients.ts`

## Invariants

- CLI 默认从消费项目根目录加载 `openapi/clients.ts`。
- CLI 必须支持 `--config <path>` 覆盖默认配置路径。
- manifest 中所有相对路径必须按**消费项目根目录**解析，而不是按包仓库目录解析。

## Constraints

- 不要在包内内置任何项目 manifest 示例为运行时依赖；fixture 示例放到后续 `Task 04`。
- 不要要求消费项目提供本地 runtime core；manifest 只描述 `specs`、输出目录、query client accessor、adapters 邻接目录等项目侧信息。

## Shared Runtime Contracts

- `manifest-cli-contract`

## Acceptance Criteria

- [ ] `profile: task-02-core` 通过
- [ ] `defineClientManifests([...])` 成为项目侧唯一推荐写法
- [ ] CLI 能正确解析 `generate --client dict,file-storage --config ./openapi/clients.ts`
- [ ] schema 继续约束 `queryClientImport`、`infinite + pagination`、`recommendedMaxOperations`

## Verification Profile

- `profile: task-02-core`
  - `pnpm exec vitest run tests/codegen/schema.test.ts tests/codegen/load-client-manifests.test.ts tests/codegen/args.test.ts`
- `Expected Signals:` 配置文件可被动态加载；未知 client、缺失 config、路径解析错误都会给出显式报错。

## Verification Strategy

- `infra` 任务，采用 CLI 参数与 manifest loader 的单测组合。这里验证的是接线契约，不是完整生成流程。

## Browser Gate Role

- `none`

## Manual Verification Exception

- `Waiver Reason:` not needed
- `Automated Smoke Check:` `pnpm exec vitest run tests/codegen/load-client-manifests.test.ts`
- `Manual Verification Steps:` none
- `Expected Results:` none
- `Follow-up Automation:` `not needed`, schema 和 loader 都可自动化

## Execution Recipe

1. 从当前仓库 `tools/codegen/config/schema.ts` 迁移 Zod schema，并把导出面收口到 `src/codegen/config/schema.ts`。
2. 提供 `defineClientManifests()` helper，让消费项目写 `export default defineClientManifests([...])`。
3. 实现 `loadClientManifests(projectRoot, configPath?)`，默认查找 `openapi/clients.ts` 并以项目根目录解析 `source.target`、`outputDir`、`queryClientImport.from`。
4. 在 `src/codegen/cli/args.ts` 里定义 `generate` 与 `fetch-spec` 的参数协议，至少支持 `--config`、`--client`、`--cwd`。
5. 运行 `profile: task-02-core`。
6. Commit `feat: add manifest loader and cli contract`

## Notes For Executor

- 项目侧 manifest 推荐形态：

```ts
import { defineClientManifests } from '@oig/react-query-generator/codegen';

export default defineClientManifests([
  {
    name: 'dict',
    source: { kind: 'file', target: 'openapi/specs/java-demo.json' },
    outputDir: 'src/lib/api/clients/dict/generated',
    queryKeyPrefix: ['dict'],
    queryClientImport: { from: '@/lib/query-client', name: 'getQueryClient' },
    transportProfile: { viaBff: true, basePath: '/api' },
    responseProfile: { wrapper: 'data', successCode: 200 }
  }
]);
```
