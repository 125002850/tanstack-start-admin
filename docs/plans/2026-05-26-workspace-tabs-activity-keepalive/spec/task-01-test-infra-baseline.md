# Task 01: Bun 测试基线

**Depends on:** `none`
**Blocks:** `Task 03, Task 04, Task 05, Task 06, Task 07, Task 08`
**Type:** `infra`

## Goal

为后续 workspace 功能提供最小可用的 Bun + Vitest + Testing Library + Playwright smoke 基线，并保持现有构建/运行方式不变。

## Files

- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke/vitest-environment.test.ts`
- Create: `e2e/workspace-tabs-smoke.spec.ts`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `env.example.txt`
- Reference: `README.md`
- Reference: `tsconfig.json`

## Invariants

- 继续以 README 规定的 Bun 工具链为准，不新增第二套执行入口。
- 现有 `bun run dev`、`bun run build`、`bun run lint` 行为必须保持可用。
- 不在本任务里触碰任何业务组件、路由或 feature 行为。

## Constraints

- 不修改 `pnpm-lock.yaml`。
- 不引入 Cypress；浏览器级自动化仅引入一条最小 `@playwright/test` smoke 路径。
- 只添加后续任务确实会用到的最小测试依赖：`vitest`、`jsdom`、`@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`@playwright/test`。

## Acceptance Criteria

- [ ] `bunx vitest run src/test/smoke/vitest-environment.test.ts` 通过
- [ ] `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@baseline"` 通过
- [ ] `bun run lint` 通过
- [ ] `bun run build` 通过
- [ ] `bun run test:unit` 可作为后续任务的统一单测入口
- [ ] `bun run test:e2e:smoke` 可作为后续任务的浏览器级 smoke 入口

## Verification Strategy

`infra` 任务使用构建 + smoke check。这里的风险不仅是 DOM 测试运行时，还包括后续 keep-alive 行为至少要有一条浏览器级自动化入口，因此同时建立 Vitest 和 Playwright 的最小基线最合适。

## Execution Recipe

1. 在 `package.json` 中新增 `test:unit` 与 `test:e2e:smoke` 脚本，并添加所需 devDependencies。
2. 运行 `bun install`，只更新 `bun.lock`。
3. 新建 `vitest.config.ts` 与 `src/test/setup.ts`，配置 `jsdom`、路径别名和 `jest-dom` 扩展。
4. 新建 `playwright.config.ts`，让它通过 `bun run dev -- --host 127.0.0.1 --port 3000` 启动本地服务，并只跑 Chromium smoke。
5. 新建 `src/test/smoke/vitest-environment.test.ts`，验证 Testing Library 可以在当前仓库正常渲染并断言 DOM。
6. 新建 `e2e/workspace-tabs-smoke.spec.ts`，先写一个 `@baseline` smoke：访问 `/dashboard/overview` 并断言页面主 chrome 正常渲染。
7. 在 `env.example.txt` 中加入可选的 `VITE_ENABLE_WORKSPACE_TABS=1` 注释占位，后续任务复用。
8. 依次运行 `bunx vitest run src/test/smoke/vitest-environment.test.ts`、`bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@baseline"`、`bun run lint`、`bun run build`。
9. 提交建议：`git commit -m "test: add unit and browser smoke baseline"`

## Notes For Executor

- 推荐在 `vitest.config.ts` 中显式设置 `environment: 'jsdom'` 和 `setupFiles: ['src/test/setup.ts']`。
- `src/test/setup.ts` 只注册测试运行时需要的全局扩展；不要在这里挂业务 mock。
- Playwright smoke 在本任务里只先落 `@baseline`；后续 Task 08 会在同一 spec 文件里扩出 `@workspace` 与 `@workspace-rollback` 两条回归路径，而不是另起第二套 E2E 结构。
